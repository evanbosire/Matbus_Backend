const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Employee = require('../models/Employee');
const TrainingMaterial = require('../models/TrainingMaterial');
const Inventory = require('../models/Inventory');
const MaterialRequest = require('../models/MaterialRequest');

// Helper: start session if available
async function withTransaction(fn) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => { result = await fn(session); });
  } finally {
    session.endSession();
  }
  return result;
}

// GET /api/material-requests/materials
// Get all available training materials
router.get('/materials', async (req, res) => {
  try {
    const materials = await TrainingMaterial.find({}, 'name unit');
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 1) Trainer creates a material request
// POST /api/material-requests
// Trainer requests training materials
router.post('/', async (req, res) => {
  try {
    const { materialId, quantityRequested, employeeId, note } = req.body;

    // 1️⃣ Validate input
    if (!materialId || !quantityRequested || !employeeId) {
      return res.status(400).json({ message: 'materialId, quantityRequested and employeeId are required' });
    }

    // 2️⃣ Verify requester is a trainer
    const trainer = await Employee.findById(employeeId);
    if (!trainer || trainer.role.toLowerCase() !== 'trainer') {
      return res.status(403).json({ message: 'Only trainers can request materials' });
    }

    // 3️⃣ Confirm the training material exists
    const material = await TrainingMaterial.findById(materialId);
    if (!material) {
      return res.status(404).json({ message: 'Training material not found' });
    }

    // 4️⃣ Create the material request (status is pending until inventory manager releases it)
    const mr = new MaterialRequest({
      material: materialId,
      quantityRequested,
      requestedBy: employeeId,
      note,
      status: 'pending' // e.g., pending | approved | rejected | returned
    });

    await mr.save();
    await mr.populate('material', 'name unit');

    // 5️⃣ Response
    res.status(201).json({
      message: 'Material request created successfully',
      materialRequest: mr
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// 5) Trainer returns issued materials to inventory
// PUT /api/material-requests/:id/return
// body: { employeeId, quantityToReturn }  (employeeId should be the trainer who requested)
router.put('/:id/return', async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, quantityToReturn } = req.body;

    if (!employeeId || !quantityToReturn) {
      return res.status(400).json({ message: 'employeeId and quantityToReturn required' });
    }

    const trainer = await Employee.findById(employeeId);
    if (!trainer || trainer.role !== 'Trainer') {
      return res.status(403).json({ message: 'Only trainers can return materials' });
    }

    const mr = await MaterialRequest.findById(id);
    if (!mr) return res.status(404).json({ message: 'Material request not found' });
    if (mr.requestedBy.toString() !== employeeId) {
      return res.status(403).json({ message: 'You did not request this material' });
    }
    if (mr.status !== 'released' && mr.status !== 'partially_returned') {
      return res.status(400).json({ message: 'Material has not been released or already returned' });
    }

    const maxReturnable = mr.quantityIssued - (mr.quantityReturned || 0);
    if (quantityToReturn <= 0 || quantityToReturn > maxReturnable) {
      return res.status(400).json({ message: `quantityToReturn must be >0 and <= ${maxReturnable}` });
    }

    // transactionally increment inventory, update MR
    const doReturn = async (session) => {
      let inv = await Inventory.findOne({ material: mr.material }).session(session);
      if (!inv) {
        // create inventory record if none exists
        inv = new Inventory({ material: mr.material, quantity: 0 });
      }
      inv.quantity += quantityToReturn;
      await inv.save({ session });

      // update material request
      mr.quantityReturned = (mr.quantityReturned || 0) + quantityToReturn;
      mr.returnedBy = trainer._id;
      mr.returnedAt = new Date();

      if (mr.quantityReturned === mr.quantityIssued) {
        mr.status = 'returned';
      } else {
        mr.status = 'partially_returned';
      }
      await mr.save({ session });

      return { inventory: inv, materialRequest: mr };
    };

    let result;
    try {
      result = await withTransaction(doReturn);
    } catch (txErr) {
      return res.status(500).json({ message: txErr.message });
    }

    await mr.populate('material', 'name unit');
    res.json({ message: 'Return processed', materialRequest: mr, inventory: result.inventory });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2) Inventory manager lists requests (filter by status optionally)
// GET /api/material-requests?status=pending
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const requests = await MaterialRequest.find(query)
      .populate('material', 'name unit')
      .populate('requestedBy', 'firstName lastName email')
      .populate('processedBy', 'firstName lastName');

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3) Inventory manager approves/release (decrease inventory)
// PUT /api/material-requests/:id/approve
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: 'employeeId required' });
    }

    // validate inventory manager
    const manager = await Employee.findById(employeeId);
    if (!manager || manager.role !== 'Inventory manager') {
      return res.status(403).json({ message: 'Only inventory managers can approve and release materials' });
    }

    const mr = await MaterialRequest.findById(id);
    if (!mr) return res.status(404).json({ message: 'Material request not found' });
    if (mr.status !== 'pending') return res.status(400).json({ message: `Request already processed (${mr.status})` });

    const quantityToIssue = mr.quantityRequested; // automatically use the requested quantity

    // Do atomic inventory decrement using a transaction where possible
    const doRelease = async (session) => {
      // find inventory record
      const inv = await Inventory.findOne({ material: mr.material }).session(session);
      if (!inv || inv.quantity < quantityToIssue) {
        throw new Error('Insufficient inventory to fulfill request');
      }

      // decrement inventory
      inv.quantity -= quantityToIssue;
      await inv.save({ session });

      // update material request
      mr.quantityIssued = quantityToIssue;
      mr.status = 'released';
      mr.processedBy = manager._id;
      mr.processedAt = new Date();
      await mr.save({ session });

      return { inventory: inv, materialRequest: mr };
    };

    let result;
    try {
      result = await withTransaction(doRelease);
    } catch (txErr) {
      return res.status(400).json({ message: txErr.message });
    }

    await mr.populate('material', 'name unit');
    await mr.populate('requestedBy', 'firstName lastName');

    res.json({ message: 'Materials released', materialRequest: mr, inventory: result.inventory });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// 4) Inventory manager rejects the request
// PUT /api/material-requests/:id/reject
// body: { employeeId }  (optional: note)
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, note } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: 'employeeId required' });
    }

    // validate inventory manager
    const manager = await Employee.findById(employeeId);
    if (!manager || manager.role !== 'inventory_manager') {
      return res.status(403).json({ message: 'Only inventory managers can reject requests' });
    }

    const mr = await MaterialRequest.findById(id);
    if (!mr) return res.status(404).json({ message: 'Material request not found' });
    if (mr.status !== 'pending') return res.status(400).json({ message: `Request already processed (${mr.status})` });

    // update request to rejected
    mr.status = 'rejected';
    mr.processedBy = manager._id;
    mr.processedAt = new Date();
    if (note) mr.note = note; // only update note if provided
    await mr.save();

    await mr.populate('material', 'name unit');
    await mr.populate('requestedBy', 'firstName lastName');

    res.json({ message: 'Material request rejected', materialRequest: mr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




module.exports = router;
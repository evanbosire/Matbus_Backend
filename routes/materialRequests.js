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
router.get('/materials', async (req, res) => {
  try {
    // Your materials logic here
    const materials = await Inventory.find({}).populate('material', 'name unit');
    const transformedMaterials = materials.map(item => ({
      _id: item.material._id.toString(),
      name: item.material.name,
      unit: item.material.unit,
      availableQuantity: item.quantity
    }));
    res.json(transformedMaterials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/material-requests/trainer/:trainerId
router.get('/trainer/:trainerId', async (req, res) => {
  try {
    const { trainerId } = req.params;
    const requests = await MaterialRequest.find({ requestedBy: trainerId })
      .populate('material', 'name unit')
      .populate('requestedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(requests);
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

    console.log('Received material request:', { materialId, quantityRequested, employeeId, note });

    // 1️⃣ Validate input
    if (!materialId || !quantityRequested || !employeeId) {
      return res.status(400).json({ 
        message: 'materialId, quantityRequested and employeeId are required',
        received: { materialId, quantityRequested, employeeId }
      });
    }

    // 2️⃣ Verify requester is a trainer
    const trainer = await Employee.findById(employeeId);
    if (!trainer) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    if (trainer.role.toLowerCase() !== 'trainer') {
      return res.status(403).json({ 
        message: 'Only trainers can request materials',
        userRole: trainer.role 
      });
    }

    // 3️⃣ Confirm the training material exists in Inventory
    const inventoryItem = await Inventory.findOne({ material: materialId })
      .populate('material', 'name unit');
    
    if (!inventoryItem) {
      return res.status(404).json({ 
        message: 'Training material not found in inventory',
        materialId: materialId 
      });
    }

    // 4️⃣ Check if sufficient quantity is available
    if (inventoryItem.quantity < quantityRequested) {
      return res.status(400).json({
        message: `Insufficient inventory. Only ${inventoryItem.quantity} ${inventoryItem.material.unit} available`,
        available: inventoryItem.quantity,
        requested: quantityRequested
      });
    }

    // 5️⃣ Create the material request (status is pending until inventory manager releases it)
    const mr = new MaterialRequest({
      material: materialId,
      quantityRequested,
      requestedBy: employeeId,
      note: note || `Request for training materials`,
      status: 'pending'
    });

    await mr.save();
    await mr.populate('material', 'name unit');
    await mr.populate('requestedBy', 'firstName lastName');

    console.log('Material request created successfully:', mr._id);

    // 6️⃣ Response
    res.status(201).json({
      message: 'Material request created successfully and pending approval',
      materialRequest: mr
    });

  } catch (err) {
    console.error('Error creating material request:', err);
    res.status(500).json({ 
      message: 'Failed to create material request: ' + err.message
    });
  }
});

// 5) Trainer returns issued materials to inventory
// PUT /api/material-requests/:id/return
router.put('/:id/return', async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, quantityToReturn } = req.body;

    console.log('Processing return:', { id, employeeId, quantityToReturn });

    if (!employeeId || !quantityToReturn) {
      return res.status(400).json({ message: 'employeeId and quantityToReturn are required' });
    }

    // Validate trainer
    const trainer = await Employee.findById(employeeId);
    if (!trainer || trainer.role.toLowerCase() !== 'trainer') {
      return res.status(403).json({ message: 'Only trainers can return materials' });
    }

    // Find material request
    const mr = await MaterialRequest.findById(id)
      .populate('material', 'name unit');
    
    if (!mr) {
      return res.status(404).json({ message: 'Material request not found' });
    }
    
    // Verify ownership
    if (mr.requestedBy.toString() !== employeeId) {
      return res.status(403).json({ message: 'You did not request this material' });
    }
    
    // Check if material can be returned
    if (mr.status !== 'released' && mr.status !== 'partially_returned') {
      return res.status(400).json({ 
        message: 'Material has not been released or is already fully returned',
        currentStatus: mr.status 
      });
    }

    const maxReturnable = (mr.quantityIssued || 0) - (mr.quantityReturned || 0);
    if (quantityToReturn <= 0 || quantityToReturn > maxReturnable) {
      return res.status(400).json({ 
        message: `Quantity to return must be greater than 0 and less than or equal to ${maxReturnable}`,
        maxReturnable: maxReturnable 
      });
    }

    // Process return transactionally
    const doReturn = async (session) => {
      // Find or create inventory record
      let inv = await Inventory.findOne({ material: mr.material }).session(session);
      if (!inv) {
        inv = new Inventory({ 
          material: mr.material, 
          quantity: quantityToReturn,
          minStockLevel: 5
        });
      } else {
        inv.quantity += quantityToReturn;
      }
      await inv.save({ session });

      // Update material request
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
      console.error('Transaction error during return:', txErr);
      return res.status(500).json({ message: 'Failed to process return: ' + txErr.message });
    }

    // Populate final data
    await mr.populate('material', 'name unit');
    await mr.populate('returnedBy', 'firstName lastName');

    res.json({ 
      message: `Successfully returned ${quantityToReturn} items`, 
      materialRequest: mr,
      inventory: {
        quantity: result.inventory.quantity,
        material: result.inventory.material
      }
    });
  } catch (err) {
    console.error('Error processing return:', err);
    res.status(500).json({ message: 'Failed to process return: ' + err.message });
  }
});

// 2) Inventory manager lists requests (filter by status optionally)
// GET /api/material-requests?status=pending
router.get('/requested-trainer-materials', async (req, res) => {
  try {
    const { status, trainerId } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (trainerId) query.requestedBy = trainerId;

    const requests = await MaterialRequest.find(query)
      .populate('material', 'name unit')
      .populate('requestedBy', 'firstName lastName email')
      .populate('processedBy', 'firstName lastName')
      .populate('returnedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error('Error fetching material requests:', err);
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

    // Validate inventory manager
    const manager = await Employee.findById(employeeId);
    if (!manager || manager.role.toLowerCase() !== 'inventory manager') {
      return res.status(403).json({ message: 'Only inventory managers can approve and release materials' });
    }

    const mr = await MaterialRequest.findById(id);
    if (!mr) return res.status(404).json({ message: 'Material request not found' });
    if (mr.status !== 'pending') return res.status(400).json({ message: `Request already processed (${mr.status})` });

    const quantityToIssue = mr.quantityRequested;

    // Process release transactionally
    const doRelease = async (session) => {
      // Find inventory record
      const inv = await Inventory.findOne({ material: mr.material }).session(session);
      if (!inv) {
        throw new Error('Material not found in inventory');
      }
      
      if (inv.quantity < quantityToIssue) {
        throw new Error(`Insufficient inventory. Available: ${inv.quantity}, Requested: ${quantityToIssue}`);
      }

      // Decrement inventory
      inv.quantity -= quantityToIssue;
      await inv.save({ session });

      // Update material request
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
    await mr.populate('processedBy', 'firstName lastName');

    res.json({ 
      message: 'Materials released successfully', 
      materialRequest: mr, 
      inventory: result.inventory 
    });
  } catch (err) {
    console.error('Error approving request:', err);
    res.status(500).json({ message: err.message });
  }
});

// 4) Inventory manager rejects the request
// PUT /api/material-requests/:id/reject
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, note } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: 'employeeId required' });
    }

    // Validate inventory manager - fixed role check
    const manager = await Employee.findById(employeeId);
    if (!manager || manager.role.toLowerCase() !== 'inventory manager') {
      return res.status(403).json({ message: 'Only inventory managers can reject requests' });
    }

    const mr = await MaterialRequest.findById(id);
    if (!mr) return res.status(404).json({ message: 'Material request not found' });
    if (mr.status !== 'pending') return res.status(400).json({ message: `Request already processed (${mr.status})` });

    // Update request to rejected
    mr.status = 'rejected';
    mr.processedBy = manager._id;
    mr.processedAt = new Date();
    if (note) mr.rejectionNote = note;
    await mr.save();

    await mr.populate('material', 'name unit');
    await mr.populate('requestedBy', 'firstName lastName');
    await mr.populate('processedBy', 'firstName lastName');

    res.json({ message: 'Material request rejected', materialRequest: mr });
  } catch (err) {
    console.error('Error rejecting request:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
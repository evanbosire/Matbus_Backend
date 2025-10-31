const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const Inventory  = require('../models/Inventory');
const SupplyRequest = require('../models/SupplyRequest');
const TrainingMaterial = require('../models/TrainingMaterial');


// Get meterials from the db
router.get('/training-materials', async (req, res) => {
  try {
    const materials = await TrainingMaterial.find();
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create supply request
router.post('/supply-requests', async (req, res) => {
  try {
    const { materialId, quantity, neededBy, note, employeeId } = req.body;

    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'Inventory manager')
      return res.status(403).json({ message: 'Only inventory managers can create supply requests' });

    const material = await TrainingMaterial.findById(materialId);
    if (!material) return res.status(404).json({ message: 'Training material not found' });

    const sr = new SupplyRequest({ material: materialId, quantity, requestedBy: employeeId, neededBy, note });
    await sr.save();
    await sr.populate('material', 'name description');
    res.status(201).json(sr);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Receive delivered supply
router.put('/supply-requests/receive/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note, employeeId } = req.body;

    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'Inventory manager')
      return res.status(403).json({ message: 'Only inventory managers can receive deliveries' });

    const sr = await SupplyRequest.findById(id);
    if (!sr) return res.status(404).json({ message: 'Supply request not found' });
    if (sr.status !== 'delivered')
      return res.status(400).json({ message: 'Supply must be delivered first' });

    if (action === 'accept') {
      let inv = await Inventory.findOne({ material: sr.material });
      if (inv) inv.quantity += sr.quantity;
      else inv = new Inventory({ material: sr.material, quantity: sr.quantity });
      await inv.save();

      sr.status = 'inventory_accepted';
      sr.acceptedBy = employeeId;
      sr.acceptanceDate = new Date();
      sr.deliveryNote = note;
      await sr.save();
      return res.json({ message: 'Supply accepted and inventory updated', supplyRequest: sr });
    }

    if (action === 'reject') {
      sr.status = 'inventory_rejected';
      sr.deliveryNote = note;
      await sr.save();
      return res.json({ message: 'Supply rejected', supplyRequest: sr });
    }

    res.status(400).json({ message: 'Invalid action' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



// Get inventory list
router.get('/inventory', async (req, res) => {
  try {
    const items = await Inventory.find().populate('material', 'name description category');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



module.exports = router;

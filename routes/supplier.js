const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const SupplyRequest = require('../models/SupplyRequest');

// Get supply requests from the inventory
router.get('/supply-requests/pending', async (req, res) => {
  try {
    const requests = await SupplyRequest.find({ status: 'pending', supplier: { $exists: false } })
      .populate('material', 'name description')
      .populate('requestedBy', 'firstName lastName');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Supplier accept/reject
router.put('/supply-requests/:id/respond', async (req, res) => {
  try {
    const { status, pricePerUnit, note, employeeId } = req.body;
    const sr = await SupplyRequest.findById(req.params.id);
    const employee = await Employee.findById(employeeId);

    if (!employee || employee.role !== 'Supplier')
      return res.status(403).json({ message: 'Only suppliers can respond' });
    if (!sr) return res.status(404).json({ message: 'Supply request not found' });
    if (sr.status !== 'pending') return res.status(400).json({ message: 'Already processed' });

    if (status === 'accepted') {
      if (!pricePerUnit || pricePerUnit <= 0)
        return res.status(400).json({ message: 'pricePerUnit required' });

      sr.status = 'accepted_by_supplier';
      sr.supplier = employeeId;
      sr.pricePerUnit = pricePerUnit;
      sr.totalPrice = sr.quantity * pricePerUnit;
      sr.note = note;
      await sr.save();
      return res.json({ message: 'Accepted and quoted', supplyRequest: sr });
    }

    if (status === 'rejected') {
      sr.status = 'rejected_by_supplier';
      sr.supplier = employeeId;
      sr.note = note;
      await sr.save();
      return res.json({ message: 'Rejected', supplyRequest: sr });
    }

    res.status(400).json({ message: 'Invalid status' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Get SUPPLIED MATERIALS TO MARK THEM AS DELIVERED
router.get('/supply-requests/delivered', async (req, res) => {
  try {
    const requests = await SupplyRequest.find({ status: 'accepted_by_supplier' })
      .populate('material', 'name description unit')
      .populate('requestedBy', 'firstName lastName')
      .populate('supplier', 'firstName lastName')
      .sort({ deliveryDate: -1 });
    
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Mark delivered before the inventory accepts the supplied materials.
router.put('/supply-requests/deliver/:id', async (req, res) => {
  try {
    const { employeeId, note } = req.body;
    const employee = await Employee.findById(employeeId);
    const sr = await SupplyRequest.findById(req.params.id);

    if (!employee || employee.role !== 'Supplier')
      return res.status(403).json({ message: 'Only suppliers can deliver' });
    if (!sr) return res.status(404).json({ message: 'Not found' });
    if (sr.supplier.toString() !== employeeId)
      return res.status(403).json({ message: 'Unauthorized' });
    if (sr.status !== 'accepted_by_supplier')
      return res.status(400).json({ message: 'Must be accepted first' });

    sr.status = 'delivered';
    sr.deliveryDate = new Date();
    sr.deliveryNote = note;
    await sr.save();
    res.json({ message: 'Marked as delivered', supplyRequest: sr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

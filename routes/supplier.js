// const express = require('express');
// const SupplyRequest = require('../models/SupplyRequest');
// const Employee = require('../models/Employee');
// const router = express.Router();

// // Get all supply requests assigned to the supplier
// router.get('/supply-requests/:employeeId', async (req, res) => {
//   try {
//     const { employeeId } = req.params;
    
//     const employee = await Employee.findById(employeeId);
//     if (!employee || employee.role !== 'supplier') {
//       return res.status(403).json({ message: 'Only suppliers can access this endpoint' });
//     }
    
//     const supplyRequests = await SupplyRequest.find({ supplier: employeeId })
//       .populate('material', 'name description')
//       .populate('requestedBy', 'firstName lastName');
    
//     res.json(supplyRequests);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Get all pending supply requests (for suppliers to accept)
// router.get('/supply-requests/pending', async (req, res) => {
//   try {
//     const supplyRequests = await SupplyRequest.find({ 
//       status: 'pending',
//       supplier: { $exists: false }
//     })
//       .populate('material', 'name description')
//       .populate('requestedBy', 'firstName lastName');
    
//     res.json(supplyRequests);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Accept or reject a supply request
// router.put('/supply-requests/:requestId', async (req, res) => {
//   try {
//     const { requestId } = req.params;
//     const { status, note, employeeId } = req.body;
    
//     const employee = await Employee.findById(employeeId);
//     if (!employee || employee.role !== 'supplier') {
//       return res.status(403).json({ message: 'Only suppliers can accept supply requests' });
//     }
    
//     const supplyRequest = await SupplyRequest.findById(requestId);
    
//     if (!supplyRequest) {
//       return res.status(404).json({ message: 'Supply request not found' });
//     }
    
//     if (supplyRequest.status !== 'pending') {
//       return res.status(400).json({ message: 'Supply request already processed' });
//     }
    
//     supplyRequest.status = status;
//     supplyRequest.supplier = employeeId;
    
//     if (note) {
//       supplyRequest.note = note;
//     }
    
//     await supplyRequest.save();
    
//     res.json({ message: `Supply request ${status} successfully`, supplyRequest });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Mark supply as delivered
// router.put('/supply-requests/deliver/:requestId', async (req, res) => {
//   try {
//     const { requestId } = req.params;
//     const { note, employeeId } = req.body;
    
//     const employee = await Employee.findById(employeeId);
//     if (!employee || employee.role !== 'supplier') {
//       return res.status(403).json({ message: 'Only suppliers can mark supplies as delivered' });
//     }
    
//     const supplyRequest = await SupplyRequest.findById(requestId);
    
//     if (!supplyRequest) {
//       return res.status(404).json({ message: 'Supply request not found' });
//     }
    
//     if (supplyRequest.supplier.toString() !== employeeId) {
//       return res.status(403).json({ message: 'Not authorized to deliver this supply request' });
//     }
    
//     if (supplyRequest.status !== 'approved') {
//       return res.status(400).json({ message: 'Supply request must be approved before delivery' });
//     }
    
//     supplyRequest.status = 'delivered';
//     supplyRequest.deliveryDate = new Date();
    
//     if (note) {
//       supplyRequest.deliveryNote = note;
//     }
    
//     await supplyRequest.save();
    
//     res.json({ message: 'Supply marked as delivered successfully', supplyRequest });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// module.exports = router;


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

// // Get supplier’s assigned requests
// router.get('/supply-requests/:employeeId', async (req, res) => {
//   try {
//     const employee = await Employee.findById(req.params.employeeId);
//     if (!employee || employee.role !== 'Supplier')
//       return res.status(403).json({ message: 'Only suppliers can access this' });

//     const requests = await SupplyRequest.find({ supplier: req.params.employeeId })
//       .populate('material', 'name description')
//       .populate('requestedBy', 'firstName lastName');
//     res.json(requests);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

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

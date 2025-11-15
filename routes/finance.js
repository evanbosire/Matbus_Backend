const express = require('express');
const Payment = require('../models/Payment');
const Donation = require('../models/Donation');
const Enrollment = require('../models/Enrollment');
const SupplyRequest = require('../models/SupplyRequest');
const Employee = require('../models/Employee');
const router = express.Router();



const SupplyPayment = require('../models/SupplyPayment');
const { validateMpesaCode } = require('../utils/validateMpesaCode');
const Finance = require('../models/Finance');


// Get all pending payments
router.get('/payments/pending', async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'pending' })
      .populate('payer', 'customerName email')
      .populate('course', 'title duration');
    res.json(payments);
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    res.status(500).json({ message: error.message });
  }
});

// Finance Manager verifies a payment for an enrolled course
router.put('/payments/verify/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status !== 'pending') {
      return res.status(400).json({ message: 'Payment already processed' });
    }

    // Auto-assign finance manager (replace with actual ID from your DB)
    const financeManagerId = "68aae96afcb358a771829f90";

    // Set payment verified
    payment.status = "verified";
    payment.verifiedBy = financeManagerId;
    payment.verificationDate = new Date();
    await payment.save();

    // If it's a course payment, update linked enrollment status
    if (payment.type === 'course_payment' && payment.relatedEnrollment) {
      const enrollment = await Enrollment.findById(payment.relatedEnrollment);
      if (enrollment) {
        enrollment.status = 'payment_verified';
        await enrollment.save();
      }
    }

    res.json({ message: "Payment verified successfully", payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//   ******************** DONATIONS ***************

// // Get all pending donations
// router.get('/donations/pending', async (req, res) => {
//   try {
//     const donations = await Donation.find({ status: 'pending' })
//       .populate('donor', 'firstName lastName email');
    
//     res.json(donations);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Approve or reject a donation
// router.put('/donations/:donationId', async (req, res) => {
//   try {
//     const { donationId } = req.params;
//     const { status, employeeId } = req.body;
    
//     const donation = await Donation.findById(donationId);
    
//     if (!donation) {
//       return res.status(404).json({ message: 'Donation not found' });
//     }
    
//     if (donation.status !== 'pending') {
//       return res.status(400).json({ message: 'Donation already processed' });
//     }
    
//     const employee = await Employee.findById(employeeId);
//     if (!employee || employee.role !== 'Finance manager') {
//       return res.status(403).json({ message: 'Only finance managers can approve donations' });
//     }
    
//     donation.status = status;
//     donation.approvedBy = employeeId;
//     donation.approvalDate = new Date();
    
//     await donation.save();
    
//     res.json({ message: `Donation ${status} successfully`, donation });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// Get all pending donations
router.get('/donations/pending', async (req, res) => {
  try {
    const donations = await Donation.find({ status: 'pending' })
      .populate('donor', 'firstName lastName email');
    
    res.json(donations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve or reject a donation
router.put('/donations/:donationId', async (req, res) => {
  try {
    const { donationId } = req.params;
    const { status, employeeId } = req.body;
    
    const donation = await Donation.findById(donationId);
    
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }
    
    if (donation.status !== 'pending') {
      return res.status(400).json({ message: 'Donation already processed' });
    }
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'Finance manager') {
      return res.status(403).json({ message: 'Only finance managers can approve donations' });
    }
    
    donation.status = status;
    donation.approvedBy = employeeId;
    donation.approvalDate = new Date();
    
    await donation.save();

    // If donation is approved, update finance records
    if (status === 'approved') {
      await updateFinanceRecords(donation);
    }
    
    res.json({ message: `Donation ${status} successfully`, donation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get finance dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const finance = await Finance.getFinanceRecord();
    const summary = finance.getSummary();
    
    // Get recent donations for dashboard
    const recentDonations = await Donation.find({ status: 'approved' })
      .populate('donor', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ approvalDate: -1 })
      .limit(5);

    res.json({
      ...summary,
      recentDonations,
      monthlyBreakdown: finance.monthlyBreakdown.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      }).slice(0, 12), // Last 12 months
      currentMonthStats: finance.currentMonthStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add expense endpoint
router.post('/expenses', async (req, res) => {
  try {
    const { description, amount, category, employeeId, receiptUrl } = req.body;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'Finance manager') {
      return res.status(403).json({ message: 'Only finance managers can add expenses' });
    }
    
    const finance = await Finance.getFinanceRecord();
    await finance.addExpense(description, amount, category, employeeId, receiptUrl);
    
    res.json({ 
      message: 'Expense recorded successfully',
      expense: finance.expenseRecords[finance.expenseRecords.length - 1]
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get expense records
router.get('/expenses', async (req, res) => {
  try {
    const finance = await Finance.getFinanceRecord();
    res.json(finance.expenseRecords.sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to update finance records
async function updateFinanceRecords(donation) {
  try {
    const finance = await Finance.getFinanceRecord();
    await finance.addDonation(donation._id, donation.amount, donation.donor);
    console.log(`Finance updated: +KES ${donation.amount}`);
  } catch (error) {
    console.error('Error updating finance records:', error);
  }
}

// Process supplier payment *******
// Get payable supplies
router.get('/payable-supplies', async (req, res) => {
  try {
    const list = await SupplyRequest.find({
      status: 'inventory_accepted',
      supplyPayment: { $exists: false }
    })
      .populate('material', 'name')
      .populate('supplier', 'firstName lastName company');
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Process supplier payment
router.post('/supplier-payment', async (req, res) => {
  try {
    const { supplyRequestIds, mpesaCode, employeeId } = req.body;
    const financeManager = await Employee.findById(employeeId);

    if (!financeManager || financeManager.role !== 'Finance manager')
      return res.status(403).json({ message: 'Only finance managers can pay suppliers' });
    if (!validateMpesaCode(mpesaCode))
      return res.status(400).json({ message: 'Invalid M-PESA code' });

    const requests = await SupplyRequest.find({ _id: { $in: supplyRequestIds } }).populate('supplier');
    if (requests.length === 0)
      return res.status(404).json({ message: 'No supply requests found' });

    const supplierId = requests[0].supplier._id.toString();
    if (!requests.every(r => r.supplier._id.toString() === supplierId))
      return res.status(400).json({ message: 'All must belong to same supplier' });

    const totalAmount = requests.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
    const payment = new SupplyPayment({
      mpesaCode,
      amount: totalAmount,
      payer: employeeId,
      supplier: supplierId,
      relatedSupplyRequests: supplyRequestIds
    });
    await payment.save();

    await SupplyRequest.updateMany(
      { _id: { $in: supplyRequestIds } },
      { $set: { status: 'paid', supplyPayment: payment._id } }
    );

    res.status(201).json({ message: 'Supplier payment processed', payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get receipt -> for supplier and finance manager.
router.get('/receipt/:paymentId', async (req, res) => {
  try {
    const payment = await SupplyPayment.findById(req.params.paymentId)
      .populate({
        path: 'relatedSupplyRequests',
        populate: { path: 'material supplier requestedBy' }
      })
      .populate('supplier', 'firstName lastName company');

    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const receipt = {
      paymentId: payment._id,
      mpesaCode: payment.mpesaCode,
      amount: payment.amount,
      supplier: payment.supplier,
      date: payment.paymentDate,
      items: payment.relatedSupplyRequests.map(r => ({
        material: r.material.name,
        quantity: r.quantity,
        pricePerUnit: r.pricePerUnit,
        total: r.totalPrice
      }))
    };

    res.json(receipt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
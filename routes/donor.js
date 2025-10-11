const express = require('express');
const Donation = require('../models/Donation');
const Customer = require('../models/Customer');
const router = express.Router();

// Make a donation
router.post('/donate', async (req, res) => {
  try {
    const { mpesaCode, amount, customerId } = req.body;
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    const donation = new Donation({
      donor: customerId,
      mpesaCode,
      amount,
      status: 'pending'
    });
    
    await donation.save();
    
    res.status(201).json({ 
      message: 'Donation submitted. Waiting for approval.',
      donation 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get donation history
router.get('/donations/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const donations = await Donation.find({ donor: customerId })
      .populate('approvedBy', 'firstName lastName');
    
    res.json(donations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Download receipt
router.get('/donations/:donationId/receipt', async (req, res) => {
  try {
    const { donationId } = req.params;
    const { customerId } = req.query;
    
    const donation = await Donation.findOne({ 
      _id: donationId, 
      donor: customerId,
      status: 'approved'
    });
    
    if (!donation) {
      return res.status(404).json({ message: 'Approved donation not found' });
    }
    
    res.json({
      message: 'Receipt downloaded successfully',
      receipt: {
        donationId: donation._id,
        donor: customerId,
        amount: donation.amount,
        date: donation.approvalDate,
        receiptNumber: `REC-${donation._id.toString().substr(-6)}`
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
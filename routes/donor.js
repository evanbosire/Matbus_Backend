const express = require('express');
const Donation = require('../models/Donation');
const Employee = require('../models/Employee'); 
const router = express.Router();

// Make a donation
router.post('/donate', async (req, res) => {
  try {
    const { mpesaCode, amount, donorId } = req.body; 
    
    const donor = await Employee.findById(donorId);
    if (!donor) {
      return res.status(404).json({ message: 'Donor not found' });
    }

    // ✅ ensure the donor has the correct role
    if (donor.role !== 'Donor') {
      return res.status(403).json({ message: 'Only users with role "Donor" can make donations' });
    }
    
    const donation = new Donation({
      donor: donorId, 
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

// Get donation history (for a specific donor)
router.get('/donations/:donorId', async (req, res) => {
  try {
    const { donorId } = req.params;
    
    const donations = await Donation.find({ donor: donorId })
      .populate('approvedBy', 'firstName lastName role');
    
    res.json(donations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Download receipt
router.get('/donations/:donationId/receipt/:donorId', async (req, res) => {
  try {
    const { donationId, donorId } = req.params;

    // Find the approved donation for that donor
    const donation = await Donation.findOne({
      _id: donationId,
      donor: donorId,
      status: 'approved'
    });

    if (!donation) {
      return res.status(404).json({ message: 'Approved donation not found' });
    }

    // Return a simple JSON receipt
    res.json({
      message: 'Receipt downloaded successfully',
      receipt: {
        donationId: donation._id,
        donor: donorId,
        amount: donation.amount,
        date: donation.approvalDate,
        receiptNumber: `REC-${donation._id.toString().slice(-6)}`
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

// const express = require('express');
// const Donation = require('../models/Donation');
// const Employee = require('../models/Employee'); 
// const router = express.Router();

// // Make a donation
// router.post('/donate', async (req, res) => {
//   try {
//     const { mpesaCode, amount, donorId } = req.body; 
    
//     const donor = await Employee.findById(donorId);
//     if (!donor) {
//       return res.status(404).json({ message: 'Donor not found' });
//     }

//     // ✅ ensure the donor has the correct role
//     if (donor.role !== 'Donor') {
//       return res.status(403).json({ message: 'Only users with role "Donor" can make donations' });
//     }
    
//     const donation = new Donation({
//       donor: donorId, 
//       mpesaCode,
//       amount,
//       status: 'pending'
//     });
    
//     await donation.save();
    
//     res.status(201).json({ 
//       message: 'Donation submitted. Waiting for approval.',
//       donation 
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Get donation history (for a specific donor)
// router.get('/donations/:donorId', async (req, res) => {
//   try {
//     const { donorId } = req.params;
    
//     const donations = await Donation.find({ donor: donorId })
//       .populate('approvedBy', 'firstName lastName role');
    
//     res.json(donations);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // Download receipt
// router.get('/donations/:donationId/receipt/:donorId', async (req, res) => {
//   try {
//     const { donationId, donorId } = req.params;

//     // Find the approved donation for that donor
//     const donation = await Donation.findOne({
//       _id: donationId,
//       donor: donorId,
//       status: 'approved'
//     });

//     if (!donation) {
//       return res.status(404).json({ message: 'Approved donation not found' });
//     }

//     // Return a simple JSON receipt
//     res.json({
//       message: 'Receipt downloaded successfully',
//       receipt: {
//         donationId: donation._id,
//         donor: donorId,
//         amount: donation.amount,
//         date: donation.approvalDate,
//         receiptNumber: `REC-${donation._id.toString().slice(-6)}`
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// module.exports = router;

const express = require('express');
const Donation = require('../models/Donation');
const Employee = require('../models/Employee');
const PDFDocument = require('pdfkit');
const router = express.Router();

// Make a donation
router.post('/donate', async (req, res) => {
  try {
    const { mpesaCode, amount, donorId } = req.body; 
    
    const donor = await Employee.findById(donorId);
    if (!donor) {
      return res.status(404).json({ message: 'Donor not found' });
    }

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

// Download receipt as PDF
router.get('/donations/:donationId/receipt/:donorId', async (req, res) => {
  try {
    const { donationId, donorId } = req.params;

    // Find the approved donation for that donor
    const donation = await Donation.findOne({
      _id: donationId,
      donor: donorId,
      status: 'approved'
    }).populate('donor', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName');

    if (!donation) {
      return res.status(404).json({ message: 'Approved donation not found' });
    }

    // Create PDF document
    const doc = new PDFDocument();
    
    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${donation._id}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text('DONATION RECEIPT', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12);
    doc.text(`Receipt Number: REC-${donation._id.toString().slice(-6).toUpperCase()}`);
    doc.text(`Date: ${donation.approvalDate.toLocaleDateString()}`);
    doc.text(`Time: ${donation.approvalDate.toLocaleTimeString()}`);
    doc.moveDown();
    
    doc.text(`Donor Name: ${donation.donor.firstName} ${donation.donor.lastName}`);
    doc.text(`Donor Email: ${donation.donor.email}`);
    doc.moveDown();
    
    doc.text(`Transaction Code: ${donation.mpesaCode}`);
    doc.text(`Amount: KES ${donation.amount.toLocaleString()}`);
    doc.moveDown();
    
    if (donation.approvedBy) {
      doc.text(`Approved By: ${donation.approvedBy.firstName} ${donation.approvedBy.lastName}`);
    }
    
    doc.moveDown();
    doc.text('Thank you for your generous donation!', { align: 'center' });
    doc.text('MATBUS Foundation', { align: 'center' });
    
    // Finalize PDF
    doc.end();

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
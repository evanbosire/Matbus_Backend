const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const authenticateCustomer = require('../middleware/auth')
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Customer = require('../models/Customer');

// Customer creates booking
router.post('/', authenticateCustomer, async (req, res) => {
  const { serviceId, hours, paymentCode, serviceTitle } = req.body;
  try {
    // Payment validation
    const validCode = /^(?=(.*[A-Z]){8})(?=(.*\d){2})[A-Z0-9]+$/;
    if (!validCode.test(paymentCode)) {
      return res.status(400).json({ message: 'Invalid payment code' });
    }

    // Get customer
    const customer = await Customer.findById(req.customerId);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    // Get service
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    // Create booking
    const booking = new Booking({
      service: serviceId,
      serviceTitle: serviceTitle || service.title,
      customerId: customer._id,
      customerName: customer.customerName, 
      customerEmail: customer.email,      
      customerPhone: customer.phone,      
      hours,
      totalPrice: service.pricePerHour * hours,
      paymentCode
    });

    await booking.save();
    res.status(201).json(booking);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Get all bookings
router.get('/', async (req, res) => {
  try {
    const bookings = await Booking.find().populate('service'); // optional populate for service details
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching bookings', error: err.message });
  }
});
// Finance Manager approves payment
router.patch('/:id/approve-payment', async (req, res) => {
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    {
      paymentApproved: true,
      receiptUrl: `/receipts/${req.params.id}.pdf` // Mock receipt URL
    },
    { new: true }
  );
  res.json(booking);
});

// Customer to download the gym coaching receipt
router.get('/:id/generate-receipt', async (req, res) => {
  try {
    // const booking = await Booking.find().populate('service');
    const booking = await Booking.findById(req.params.id).populate('service');
   
    

    if (!booking || !booking.paymentApproved) {
      return res.status(400).json({ message: "Booking Payment not yet approved !" });
    }

    const receiptsDir = path.join(__dirname, '../public/receipts');
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const receiptPath = path.join(receiptsDir, `${booking._id}.pdf`);
    const writeStream = fs.createWriteStream(receiptPath);

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    doc.pipe(writeStream);

    // Background color
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f2f2f2');
    doc.fillColor('black');

    // Header
    doc.fontSize(22).text('Kwetu Nutrition', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text('Gym Coaching Booking Receipt', { align: 'center' });
    doc.moveDown();

    // Booking and Customer Info
    doc.fontSize(12).text(`Booking ID: ${booking._id}`);
    doc.text(`Customer Name: ${booking.customerName}`);
    doc.text(`Customer Email: ${booking.customerEmail}`);
    doc.text(`Customer Phone: ${booking.customerPhone}`);
    doc.moveDown();

    // Booking Details
    doc.text(`Service: ${booking.service.title}`);
    doc.text(`Hours: ${booking.hours}`);
    doc.text(`Total Price: ${booking.totalPrice}`);
    doc.text(`Payment Code: ${booking.paymentCode}`);
    doc.text(`Date: ${booking.createdAt.toDateString()}`);
    doc.moveDown();

    // Footer
    doc.fontSize(10).text('Thank you for choosing Kwetu Nutrition!');
    doc.text('We appreciate your trust in us and look forward to helping you achieve your goals.');
    doc.text('If you have any questions or need further assistance, feel free to contact us.');
    doc.text('We hope to see you again soon!');
    doc.moveDown();

    doc.end();

    writeStream.on('finish', async () => {
      booking.receiptUrl = `/receipts/${booking._id}.pdf`;
      await booking.save();
      res.status(200).json({
        message: 'Receipt generated successfully',
        receiptUrl: booking.receiptUrl
      });
    });

    writeStream.on('error', (err) => {
      console.error("Write stream error:", err);
      res.status(500).json({ message: "Error saving receipt file" });
    });

  } catch (err) {
    console.error("Error generating receipt:", err);
    res.status(500).json({ message: 'Error generating receipt' });
  }
});

// Supervisor views all assigned tasks with full details (assignedSupervisor is true)
router.get('/supervisor/tasks', async (req, res) => {
  try {
    const assignedTasks = await Booking.find({ assignedSupervisor: true })
      .populate('service') 
      .populate('customerId'); 

    if (assignedTasks.length === 0) {
      return res.status(404).json({ message: 'No tasks assigned to supervisors' });
    }

    res.json(assignedTasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Supervisor assigns coach
router.patch('/:id/assign-coach', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { assignedCoach: true },  
      { new: true }
    );
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Gym Coach views all assigned tasks with assignedCoach set to true
router.get('/coach/tasks', async (req, res) => {
  try {
    
    const assignedTasks = await Booking.find({ assignedCoach: true })
      .populate('service') 
      .populate('customerId'); 

    if (assignedTasks.length === 0) {
      return res.status(404).json({ message: 'No tasks assigned to this coach' });
    }

    res.json(assignedTasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



// Gym Coach marks as rendered
router.patch('/:id/mark-rendered', async (req, res) => {
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { serviceRendered: true },
    { new: true }
  );
  res.json(booking);
});
// Supervisor views tasks that has been rendered
router.get('/tasks/service-rendered', async (req, res) => {
  try {
    // Find all bookings where serviceRendered is true
    const renderedTasks = await Booking.find({ serviceRendered: true })
      .populate('service') // Populate all service details
      .populate('customerId'); // Populate all customer details

    // Check if there are any tasks with serviceRendered set to true
    if (renderedTasks.length === 0) {
      return res.status(404).json({ message: 'No tasks with rendered services found' });
    }

    // Return the full details of tasks with serviceRendered true
    res.json(renderedTasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Supervisor confirms service
router.patch('/:id/confirm-service', async (req, res) => {
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { supervisorConfirmed: true },
    { new: true }
  );
  res.json(booking);
});
// Service Manager views all tasks confirmed by them
router.get('/supervisor/confirmed-tasks', async (req, res) => {
  try {
    const confirmedTasks = await Booking.find({ supervisorConfirmed: true })
      .populate('service') 
      .populate('customerId'); 

    if (confirmedTasks.length === 0) {
      return res.status(404).json({ message: 'No confirmed tasks found' });
    }
    res.json(confirmedTasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Service Manager approves completion
router.patch('/:id/approve-service', async (req, res) => {
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { managerApproved: true },
    { new: true }
  );
  res.json(booking);
});

// Customer submits feedback
router.patch('/:id/feedback', async (req, res) => {
  const { feedback } = req.body;
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { feedback },
    { new: true }
  );
  res.json(booking);
});
// Service Manager replies to customer feedback
router.patch('/:id/reply-feedback', async (req, res) => {
  const { reply } = req.body;  // Get the service manager's reply from the request body
  
  try {
    // Validate if the reply is not empty
    if (!reply || reply.trim().length === 0) {
      return res.status(400).json({ message: 'Reply cannot be empty' });
    }

    // Find the booking and update the 'serviceManagerReply' field
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { serviceManagerReply: reply },  // Update serviceManagerReply field
      { new: true }
    );
    
    // Check if the booking was found and updated
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Return the updated booking data with the service manager's reply
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;

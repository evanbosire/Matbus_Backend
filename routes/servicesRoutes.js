const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const Booking = require('../models/Booking');

// Service Manager posts new service
router.post('/', async (req, res) => {
  const service = new Service(req.body);
  await service.save();
  res.status(201).json(service);
});

// Posted services displayed to the customer
router.get('/', async (req, res) => {
  const services = await Service.find();
  res.json(services);
});

// Service Manager views paid bookings
router.get('/paid-bookings', async (req, res) => {
  const bookings = await Booking.find({ paymentApproved: true })
    .populate('service');
  res.json(bookings);
});

// Service Manager allocates to supervisor by changing assignedSupervisor state to true
router.patch('/allocate/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { assignedSupervisor: true }, 
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

module.exports = router;
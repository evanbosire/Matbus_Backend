const mongoose = require("mongoose");
const express = require('express');
const router = express.Router();
const Employee = require("../models/Employee");
const Duty = require("../models/Duty");


router.post("/duties", async (req, res) => {
  try {
    const { dutyName, description, location, date, createdBy, capacity } = req.body;
    const manager = await Employee.findById(createdBy);

    if (!manager || manager.role !== "duties_manager") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const duty = await Duty.create({
      dutyName,
      description,
      location,
      date,
      createdBy,
      capacity,
      status: "open",
    });

    res.status(201).json(duty);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// PUT /api/duties-manager/duties/:id/approve
router.put("/duties/:id/approve", async (req, res) => {
  const duty = await Duty.findByIdAndUpdate(req.params.id, { status: "approved" }, { new: true });
  res.json(duty);
});


module.exports = router;

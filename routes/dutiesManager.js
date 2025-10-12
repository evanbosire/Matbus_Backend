const mongoose = require("mongoose");
const express = require('express');
const router = express.Router();
const Employee = require("../models/Employee");
const Duty = require("../models/Duty");


router.post("/duties", async (req, res) => {
  try {
    const { managerId, dutyName, description, location, date, capacity } = req.body;

    // Find by ID first if provided
    const manager = managerId
      ? await Employee.findById(managerId)
      : await Employee.findOne({ role: "Duties manager" });

    if (!manager || manager.role !== "Duties manager") {
      return res.status(403).json({ message: "Not authorized. Only Duties Manager can create duties." });
    }

    const duty = await Duty.create({
      dutyName,
      description,
      location,
      date,
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
  try {
    const duty = await Duty.findById(req.params.id);
    if (!duty) return res.status(404).json({ message: "Duty not found" });

    if (duty.status === "approved") {
      return res.status(400).json({ message: "Duty already approved" });
    }

    duty.status = "approved";
    await duty.save();

    res.json({ message: "Duty approved successfully", duty });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;

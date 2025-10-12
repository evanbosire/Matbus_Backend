
const express = require('express');
const router = express.Router();
const Duty = require("../models/Duty");

// PUT /api/coordinator/duties/:id/attendance
router.put("/duties/:id/attendance", async (req, res) => {
  try {
    const { coordinatorId, attendance } = req.body;

    const duty = await Duty.findById(req.params.id);
    if (!duty) return res.status(404).json({ message: "Duty not found" });

    if (!Array.isArray(attendance)) {
      return res.status(400).json({ message: "Attendance must be an array" });
    }

    attendance.forEach(({ youthId, status }) => {
      const enrolled = duty.enrolledYouths.find(
        (e) => e.youth.toString() === youthId
      );
      if (enrolled) enrolled.status = status;
    });

    duty.status = "in_progress";
    duty.coordinator = coordinatorId;
    await duty.save();

    res.json({ message: "Attendance updated successfully", duty });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;

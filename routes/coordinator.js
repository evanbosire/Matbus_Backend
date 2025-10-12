
const express = require('express');
const router = express.Router();
const Duty = require("../models/Duty");

// PUT /api/coordinator/duties/:id/attendance
router.put("/duties/:id/attendance", async (req, res) => {
  try {
    const { coordinatorId, attendance } = req.body;
    const duty = await Duty.findById(req.params.id);

    attendance.forEach(({ youthId, status }) => {
      const enrolled = duty.enrolledYouths.find(e => e.youth.toString() === youthId);
      if (enrolled) enrolled.status = status;
    });

    duty.status = "in_progress";
    duty.coordinator = coordinatorId;
    await duty.save();
    res.json(duty);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

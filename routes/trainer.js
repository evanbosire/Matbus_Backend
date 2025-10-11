const express = require('express');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Inventory = require('../models/Inventory');
const TrainingMaterial = require('../models/TrainingMaterial');
const Employee = require('../models/Employee');
const router = express.Router();


// Get all courses assigned to a trainer + youths enrolled
router.get('/:trainerId/courses', async (req, res) => {
  try {
    const { trainerId } = req.params;

    // check trainer exists & is a Trainer
    const trainer = await Employee.findOne({ _id: trainerId, role: 'Trainer' });
    if (!trainer) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    // find all courses assigned to this trainer
    const courses = await Course.find({ trainer: trainerId })
      .select('_id title description startDate endDate')
      .populate('trainer', 'firstName lastName email');

    // for each course, fetch enrolled youths
    const result = await Promise.all(
      courses.map(async (course) => {
        const enrollments = await Enrollment.find({ course: course._id, status: 'approved' })
          .populate('youth', 'customerName email phone'); // pick fields from Youth

        return {
          ...course.toObject(),
          enrolledYouths: enrollments.map((enr) => enr.youth),
        };
      })
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Get Enrollments so that the enrollmentId can be passed to the attendance route.
router.get('/courses/:courseId/enrollments', async (req, res) => {
  const { courseId } = req.params;
  const enrollments = await Enrollment.find({ course: courseId })
    .populate('youth', 'firstName lastName email');
  res.json(enrollments);
});


// Record attendance
router.post('/attendance', async (req, res) => {
  try {
    const { enrollmentId, present, employeeId } = req.body; // ⬅ removed date

    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'Trainer') {
      return res.status(403).json({ message: 'Only trainers can record attendance' });
    }

    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('course', 'title trainer');

    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    // Verify that the trainer is assigned to this course
    if (enrollment.course.trainer.toString() !== employeeId) {
      return res.status(403).json({ message: 'Not authorized to record attendance for this enrollment' });
    }

    // Auto-pick the current date/time
    const currentDate = new Date();

    // Check if attendance already recorded for this date
    const existingAttendance = enrollment.attendance.find(a =>
      a.date.toDateString() === currentDate.toDateString()
    );

    if (existingAttendance) {
      // update the record for the same day
      existingAttendance.present = present;
    } else {
      // add new attendance entry
      enrollment.attendance.push({
        date: currentDate,
        present
      });
    }

    await enrollment.save();

    res.json({ message: 'Attendance recorded successfully', enrollment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Request training materials -> from the inventory manager.
router.post('/material-request', async (req, res) => {
  try {
    const { materialId, quantity, courseId, employeeId } = req.body;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'trainer') {
      return res.status(403).json({ message: 'Only trainers can request materials' });
    }
    
    // Check if material exists
    const material = await TrainingMaterial.findById(materialId);
    if (!material) {
      return res.status(404).json({ message: 'Training material not found' });
    }
    
    // Check if course exists and is assigned to this trainer
    const course = await Course.findOne({ _id: courseId, trainer: employeeId });
    if (!course) {
      return res.status(404).json({ message: 'Course not found or not assigned to you' });
    }
    
    // Check inventory
    const inventory = await Inventory.findOne({ material: materialId });
    
    if (!inventory || inventory.quantity < quantity) {
      return res.status(400).json({ 
        message: 'Insufficient inventory. Please contact inventory manager.' 
      });
    }
    
    // Update inventory
    inventory.quantity -= quantity;
    await inventory.save();
    
    res.json({ 
      message: 'Training materials allocated successfully', 
      material: material.name,
      quantity,
      remaining: inventory.quantity
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark course as completed
router.put('/courses/:courseId/complete', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { employeeId } = req.body;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'Trainer') {
      return res.status(403).json({ message: 'Only trainers can mark courses as completed' });
    }
    
    // Verify that the trainer is assigned to this course
    const course = await Course.findOne({ _id: courseId, trainer: employeeId });
    if (!course) {
      return res.status(404).json({ message: 'Course not found or not assigned to you' });
    }
    
    // Update all enrollments for this course to completed
    await Enrollment.updateMany(
      { course: courseId, status: 'approved' },
      { 
        status: 'completed',
        completionDate: new Date()
      }
    );
    
    // Update course status
    course.status = 'completed';
    course.endDate = new Date();
    await course.save();
    
    res.json({ message: 'Course marked as completed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get feedback for trainer's courses
router.get('/feedback/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'trainer') {
      return res.status(403).json({ message: 'Only trainers can access feedback' });
    }
    
    const courses = await Course.find({ trainer: employeeId });
    const courseIds = courses.map(course => course._id);
    
    const enrollments = await Enrollment.find({ 
      course: { $in: courseIds },
      'feedback.text': { $exists: true }
    })
      .populate('youth', 'customerName')
      .populate('course', 'title')
      .select('feedback course youth');
    
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reply to feedback
router.post('/feedback/reply/:enrollmentId', async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { text, employeeId } = req.body;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'trainer') {
      return res.status(403).json({ message: 'Only trainers can reply to feedback' });
    }
    
    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('course', 'trainer');
    
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }
    
    // Verify that the trainer is assigned to this course
    if (enrollment.course.trainer.toString() !== employeeId) {
      return res.status(403).json({ message: 'Not authorized to reply to feedback for this enrollment' });
    }
    
    if (!enrollment.feedback || !enrollment.feedback.text) {
      return res.status(400).json({ message: 'No feedback found for this enrollment' });
    }
    
    enrollment.feedback.replies.push({
      user: employeeId,
      userModel: 'Employee',
      text,
      date: new Date()
    });
    
    await enrollment.save();
    
    res.json({ message: 'Reply added successfully', enrollment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
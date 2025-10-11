const express = require('express');
const Enrollment = require('../models/Enrollment');
const CommunityService = require('../models/CommunityService');
const Employee = require('../models/Employee');
const router = express.Router();

// Get assigned youths
router.get('/youths/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'mentor') {
      return res.status(403).json({ message: 'Only mentors can access this endpoint' });
    }
    
    const enrollments = await Enrollment.find({ mentor: employeeId })
      .populate('youth', 'customerName email phone')
      .populate('course', 'title duration');
    
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Provide pre-training guidance
router.post('/pre-training/:enrollmentId', async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { guidance, employeeId } = req.body;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'mentor') {
      return res.status(403).json({ message: 'Only mentors can provide guidance' });
    }
    
    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('youth', 'customerName')
      .populate('course', 'title');
    
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }
    
    if (enrollment.mentor.toString() !== employeeId) {
      return res.status(403).json({ message: 'Not authorized to provide guidance for this enrollment' });
    }
    
    res.json({ 
      message: 'Pre-training guidance provided successfully',
      youth: enrollment.youth.customerName,
      course: enrollment.course.title,
      guidance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Provide post-training guidance
router.post('/post-training/:enrollmentId', async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { guidance, employeeId } = req.body;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'mentor') {
      return res.status(403).json({ message: 'Only mentors can provide guidance' });
    }
    
    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('youth', 'customerName')
      .populate('course', 'title');
    
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }
    
    if (enrollment.mentor.toString() !== employeeId) {
      return res.status(403).json({ message: 'Not authorized to provide guidance for this enrollment' });
    }
    
    if (enrollment.status !== 'completed') {
      return res.status(400).json({ message: 'Course must be completed before providing post-training guidance' });
    }
    
    res.json({ 
      message: 'Post-training guidance provided successfully',
      youth: enrollment.youth.customerName,
      course: enrollment.course.title,
      guidance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get feedback for mentor's youths
router.get('/feedback/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'mentor') {
      return res.status(403).json({ message: 'Only mentors can access feedback' });
    }
    
    const enrollments = await Enrollment.find({ 
      mentor: employeeId,
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
    if (!employee || employee.role !== 'mentor') {
      return res.status(403).json({ message: 'Only mentors can reply to feedback' });
    }
    
    const enrollment = await Enrollment.findById(enrollmentId);
    
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }
    
    if (enrollment.mentor.toString() !== employeeId) {
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
const express = require('express');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Employee = require('../models/Employee');
const Certificate = require('../models/Certificate');
const router = express.Router();

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';



// service manager to post a course for youths to register

// Post a new course
router.post('/courses', async (req, res) => {
  try {
    const { 
      title, 
      description, 
      durationValue, 
      durationUnit, 
      fees, 
      startDate, 
      maxParticipants 
    } = req.body;

    // Validate required fields
    if (!title || !description || !durationValue || !durationUnit || !fees || !startDate) {
      return res.status(400).json({ 
        message: 'Title, description, durationValue, durationUnit, fees, and startDate are required fields' 
      });
    }

    // Calculate endDate automatically
    let calculatedEndDate = new Date(startDate);
    switch (durationUnit) {
      case "days":
        calculatedEndDate.setDate(calculatedEndDate.getDate() + durationValue);
        break;
      case "weeks":
        calculatedEndDate.setDate(calculatedEndDate.getDate() + (durationValue * 7));
        break;
      case "months":
        calculatedEndDate.setMonth(calculatedEndDate.getMonth() + durationValue);
        break;
      case "years":
        calculatedEndDate.setFullYear(calculatedEndDate.getFullYear() + durationValue);
        break;
    }

    // Create new course
    const course = new Course({
      title,
      description,
      duration: {
        value: durationValue,
        unit: durationUnit
      },
      fees,
      startDate,
      endDate: calculatedEndDate,
      maxParticipants: maxParticipants || null,
      status: 'upcoming'
    });

    // Save course to database
    await course.save();

    res.status(201).json({
      message: 'Course created successfully',
      course
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Course with this title already exists' });
    }
    
    res.status(500).json({ message: error.message });
  }
});


// Get all enrollments that need approval (payment verified)
router.get('/enrollments/pending', async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ status: 'payment_verified' })
      .populate('youth', 'customerName email phone')
      .populate('course', 'title duration fees')
      .populate('payment', 'mpesaCode amount status');
    
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve or reject an enrollment
router.put('/enrollments/:enrollmentId', async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { status } = req.body;

    const enrollment = await Enrollment.findById(enrollmentId);
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });

    if (enrollment.status !== 'payment_verified') {
      return res.status(400).json({ message: 'Enrollment is not in a state that can be approved' });
    }

    // find any service manager (no ID needed)
    const serviceManager = await Employee.findOne({ role: "Service manager" });
    if (!serviceManager) {
      return res.status(403).json({ message: 'No service manager account found' });
    }

    enrollment.status = status;
    await enrollment.save();

    if (status === 'approved') {
      await Course.findByIdAndUpdate(
        enrollment.course,
        { $inc: { currentParticipants: 1 } }
      );
    }

    res.json({ message: `Enrollment ${status} successfully`, enrollment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all employees who are Trainers so that they can be assigned a course
router.get('/employees/trainers', async (req, res) => {
  try {
    // find all employees with role Trainer
    const trainers = await Employee.find({ role: 'Trainer' })
      .select('_id firstName lastName email phoneNumber'); // pick the fields you want to show

    res.json(trainers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Assign trainer to a course
router.put('/courses/:courseId/trainer', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { trainerId } = req.body;

    // ensure a service manager exists
    const serviceManager = await Employee.findOne({ role: 'Service manager' });
    if (!serviceManager) {
      return res.status(403).json({ message: 'No service manager account found' });
    }

    // find course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // verify trainer exists and is a Trainer
    const trainer = await Employee.findOne({ _id: trainerId, role: 'Trainer' });
    if (!trainer) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    // assign trainer to the course
    course.trainer = trainerId;
    await course.save();

    res.json({ message: 'Trainer assigned successfully', course });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get completed courses waiting for approval
router.get('/courses/completed', async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ status: 'completed' })
      .populate('youth', 'customerName email')
      .populate({
        path: 'course',
        select: 'title duration trainer',
        populate: {
          path: 'trainer',
          model: 'Employee',
          select: 'firstName lastName email'
        }
      });

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Approve course completion and issue certificate
router.post('/certificate/issue', async (req, res) => {
  try {
    const { enrollmentId, employeeId } = req.body;

    // 1️⃣ Validate employee (must be service manager)
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.role !== 'Service manager') {
      return res.status(403).json({ message: 'Only service managers can issue certificates' });
    }

    // 2️⃣ Get enrollment data
    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('youth', 'customerName')
      .populate('course', 'title duration');
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });
    if (enrollment.status !== 'completed')
      return res.status(400).json({ message: 'Course must be completed before issuing certificate' });

    // 3️⃣ Ensure no duplicate certificate
    const existingCertificate = await Certificate.findOne({ enrollment: enrollmentId });
    if (existingCertificate)
      return res.status(400).json({ message: 'Certificate already issued for this enrollment' });

    // 4️⃣ Create certificate record
    const verificationCode = `MATBUS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const certificateUrl = `${BASE_URL}/certificates/${verificationCode}.pdf`;

    const certificate = new Certificate({
      youth: enrollment.youth._id,
      course: enrollment.course._id,
      enrollment: enrollmentId,
      issuedBy: employeeId,
      verificationCode,
      certificateUrl,
    });
    await certificate.save();

    // 5️⃣ Generate PDF
    const certDir = path.join(__dirname, '../certificates');
    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir);

    const filePath = path.join(certDir, `${verificationCode}.pdf`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // === DESIGN ELEMENTS ===
    const borderWidth = 20;
    doc.rect(borderWidth / 2, borderWidth / 2, doc.page.width - borderWidth, doc.page.height - borderWidth)
      .strokeColor('#004aad')
      .lineWidth(3)
      .stroke();

    // Logo
    const logoPath = path.join(__dirname, '../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width / 2 - 40, 70, { width: 80 });
    }

    // Title
    doc.moveDown(7);
    doc.font('Helvetica-Bold').fontSize(26).fillColor('#004aad')
      .text('Certificate of Completion', { align: 'center' });

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(16).fillColor('black')
      .text(`This certifies that`, { align: 'center' });

    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(22)
      .text(`${enrollment.youth.customerName}`, { align: 'center' });

    doc.moveDown(1);
    doc.font('Helvetica').fontSize(16)
      .text(`has successfully completed the course`, { align: 'center' });

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#004aad')
      .text(`${enrollment.course.title}`, { align: 'center' });

    // ✅ FIXED: Handle duration format
    let durationText = 'N/A';
    if (typeof enrollment.course.duration === 'object' && enrollment.course.duration !== null) {
      durationText = `${enrollment.course.duration.value} ${enrollment.course.duration.unit}`;
    } else if (typeof enrollment.course.duration === 'string') {
      durationText = enrollment.course.duration;
    }

    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(14).fillColor('black')
      .text(`Course Duration: ${durationText}`, { align: 'center' });

    // Verification code & date
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(12)
      .text(`Verification Code: ${verificationCode}`, { align: 'center' });
    doc.text(`Issued on: ${new Date().toLocaleDateString()}`, { align: 'center' });

    // Signature
    doc.moveDown(3);
    doc.font('Helvetica').fontSize(12).text('_____________________________', { align: 'center' });
    doc.font('Helvetica').fontSize(12).text(`${employee.firstName} ${employee.lastName}`, { align: 'center' });
    doc.text('Service Manager', { align: 'center' });

    // Footer
    doc.moveDown(4);
    doc.fontSize(10).fillColor('#777')
      .text('MATBUS Training Institute', { align: 'center' })
      .text('P.O. Box 123 - Nairobi, Kenya', { align: 'center' })
      .text('www.matbus.ac.ke', { align: 'center' });

    doc.end();

    stream.on('finish', () => {
      console.log('✅ Certificate PDF generated:', filePath);
    });

    // 6️⃣ Response with full URL
    res.status(201).json({
      message: 'Certificate issued successfully',
      certificate: {
        ...certificate._doc,
        certificateUrl: certificateUrl,
      },
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Get all feedback
router.get('/feedback', async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ 
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
    if (!employee || employee.role !== 'service_manager') {
      return res.status(403).json({ message: 'Only service managers can reply to feedback' });
    }
    
    const enrollment = await Enrollment.findById(enrollmentId);
    
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
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
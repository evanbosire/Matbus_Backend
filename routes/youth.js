const express = require("express");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Payment = require("../models/Payment");
const Certificate = require("../models/Certificate");
const Customer = require("../models/Customer");
const router = express.Router();

const PDFDocument = require("pdfkit");
const Employee = require("../models/Employee");
const Duty = require("../models/Duty");
// Get all available courses (for youth)
router.get("/courses", async (req, res) => {
  try {
    // Fetch all courses that are upcoming
    const courses = await Course.find({ status: "upcoming" }).select("-__v");

    if (!courses || courses.length === 0) {
      return res
        .status(404)
        .json({ message: "No available courses at the moment" });
    }

    res.status(200).json({
      message: "Available courses retrieved successfully",
      total: courses.length,
      courses,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
// Youth enrolls & pays for a course
router.post("/enroll", async (req, res) => {
  try {
    const { courseId, mpesaCode, customerId } = req.body;

    // 1. Check course exists
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // 2. Check customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // 3. Check duplicate enrollment
    const existingEnrollment = await Enrollment.findOne({
      youth: customerId,
      course: courseId,
    });
    if (existingEnrollment) {
      return res.status(400).json({ message: "Already enrolled in this course" });
    }

    // 4. Create payment record
    const payment = new Payment({
      mpesaCode,
      amount: course.fees,
      payer: customerId,
      type: "course_payment",
      course: courseId,
      status: "pending", // always pending initially
    });
    await payment.save();

    // 5. Create enrollment record
    const enrollment = new Enrollment({
      youth: customerId,
      course: courseId,
      payment: payment._id,
      status: "pending",
    });
    await enrollment.save();

    // 6. Link payment → enrollment
    payment.relatedEnrollment = enrollment._id;
    await payment.save();

    res.status(201).json({
      message: "Enrollment request submitted. Waiting for payment verification.",
      enrollment,
      payment,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Get youth's enrollments -> youth sees the enrollments he/she has enrolled to
router.get("/enrollments/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;

    const enrollments = await Enrollment.find({ youth: customerId })
      .populate("course", "title description duration fees")
      .populate("mentor", "firstName lastName email phoneNumber")
      .populate("payment", "mpesaCode amount status");

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Youth to Download Receipt API 
router.get("/payments/receipt/:youthId", async (req, res) => {
  try {
    const { youthId } = req.params;

    // 1. Find the most recent verified payment for this youth
    const payment = await Payment.findOne({
      payer: youthId,
      status: "verified",
    })
      .sort({ verificationDate: -1 })
      .populate("payer", "customerName email phone")
      .populate("course", "title")
      .populate("verifiedBy", "firstName lastName role");

    if (!payment) {
      return res
        .status(404)
        .json({ message: "No verified payment found for this youth" });
    }

    // 2. Setup PDF document
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=receipt_${payment._id}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    /*
     * =========================
     *     HEADER SECTION
     * =========================
     */
    doc
      .fontSize(26)
      .font("Helvetica-Bold")
      .text("MATBUS", { align: "center" });

    doc.moveDown(0.5);

    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("YOUTH PAYMENT RECEIPT", { align: "center" });

    doc.moveDown();

    // Horizontal divider
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();

    doc.moveDown();

    /*
     * =========================
     *    PAYMENT DETAILS
     * =========================
     */

    const payerName = payment.payer?.customerName || "Unknown Payer";
    const payerEmail = payment.payer?.email || "No Email";
    const courseTitle = payment.course?.title || "Not Applicable";

    doc.fontSize(14).font("Helvetica");

    doc.text(`Receipt No: ${payment._id}`);
    doc.text(`Transaction Code: ${payment.mpesaCode}`);
    doc.text(`Amount Paid: KES ${payment.amount}`);
    doc.text(`Payment Type: ${payment.type}`);
    doc.text(`Course: ${courseTitle}`);
    doc.text(`Payer: ${payerName} (${payerEmail})`);
    doc.text(
      `Date Verified: ${new Date(payment.verificationDate).toLocaleString()}`
    );

    const verifierName = payment.verifiedBy
      ? `${payment.verifiedBy.firstName} ${payment.verifiedBy.lastName}`
      : "Finance Manager";

    doc.text(`Verified By: ${verifierName}`);

    doc.moveDown(2);

    /*
     * =========================
     *     FOOTER SECTION
     * =========================
     */
    doc.fontSize(14).font("Helvetica-Oblique");
    doc.text("Thank you for your payment!", { align: "center" });

    doc.moveDown(1);

    doc
      .fontSize(12)
      .font("Helvetica")
      .text("MATBUS © 2025 – All Rights Reserved • Powered By: Aora Softwares", {
        align: "center",
      });

    doc.end();
  } catch (error) {
    console.error("Receipt Generation Error:", error);
    res.status(500).json({ message: error.message });
  }
});



// Submit feedback for a completed course
router.post("/feedback/:enrollmentId", async (req, res) => {
  try {
    const { text, rating, customerId } = req.body;
    const { enrollmentId } = req.params;

    const enrollment = await Enrollment.findById(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    if (enrollment.youth.toString() !== customerId) {
      return res
        .status(403)
        .json({
          message: "Not authorized to submit feedback for this enrollment",
        });
    }

    if (enrollment.status !== "completed") {
      return res
        .status(400)
        .json({
          message: "Course must be completed before submitting feedback",
        });
    }

    enrollment.feedback = {
      text,
      rating,
      date: new Date(),
    };

    await enrollment.save();

    res.json({ message: "Feedback submitted successfully", enrollment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Download certificates for a specific youth
router.get('/certificate/youth/:youthId', async (req, res) => {
  try {
    const { youthId } = req.params;

    const certificates = await Certificate.find({ youth: youthId })
      .populate('course', 'title duration')
      .populate('issuedBy', 'firstName lastName role')
      .sort({ createdAt: -1 });

    if (!certificates || certificates.length === 0) {
      return res.status(404).json({ message: 'No certificates found for this youth' });
    }

    res.status(200).json({
      message: 'Certificates retrieved successfully',
      certificates
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// ************ COMMUNITY SERVICE VOLUNTEER ROLES ************** //


// =====================================
// 1️⃣ View all available (open) duties
// =====================================
router.get("/duties/available", async (req, res) => {
  try {
    // Fetch only open duties (available for enrollment)
    const duties = await Duty.find({ status: "open" })
      .populate("coordinator enrolledYouths.youth", "customerName email phone");
    
    if (!duties.length) {
      return res.status(404).json({ message: "No available duties found" });
    }

    res.status(200).json(duties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// =====================================
// 2️⃣ Enroll in a duty voluntarily
// =====================================
router.post("/duties/:id/enroll", async (req, res) => {
  try {
    const { youthId } = req.body;
    const duty = await Duty.findById(req.params.id);

    if (!duty)
      return res.status(404).json({ message: "Duty not found" });

    if (duty.status !== "open")
      return res.status(400).json({ message: "Duty is closed for enrollment" });

    // Check if youth exists
    const youth = await Customer.findById(youthId);
    if (!youth)
      return res.status(404).json({ message: "Youth not found" });

    // Prevent duplicate enrollment
    const already = duty.enrolledYouths.find(
      (e) => e.youth.toString() === youthId
    );
    if (already)
      return res.status(400).json({ message: "You are already enrolled in this duty" });

    // Enforce capacity
    if (duty.enrolledYouths.length >= duty.capacity) {
      return res.status(400).json({ message: "Duty is already full" });
    }

    // Add youth to enrolled list
    duty.enrolledYouths.push({ youth: youthId, status: "enrolled" });
    await duty.save();

    res.status(200).json({
      message: "Enrolled successfully",
      duty,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// =====================================
// 3️⃣ View all duties a youth has enrolled in
// =====================================
router.get("/:youthId/duties", async (req, res) => {
  try {
    const youth = await Customer.findById(req.params.youthId);
    if (!youth)
      return res.status(404).json({ message: "Youth not found" });

    const duties = await Duty.find({ "enrolledYouths.youth": req.params.youthId })
      .populate("coordinator enrolledYouths.youth", "customerName email phone");

    if (!duties.length) {
      return res.status(404).json({ message: "No duties found for this youth" });
    }

    res.status(200).json(duties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;

const express = require("express");
const router = express.Router();
const Enrollment = require("../models/Enrollment");
const SupplyRequest = require("../models/SupplyRequest");
const Donation = require("../models/Donation"); 
const Employee = require("../models/Employee");
const Event = require("../models/CommunityService"); 
const Customer = require("../models/Customer")
const moment = require("moment");
const PDFDocument = require("pdfkit");


/**
 * GET: /api/enrollments/report
 * Description: Get enrolled youth details
 */
router.get("/youth-enrolment", async (req, res) => {
  try {
    const enrollments = await Enrollment.find()

      // Populate Youth (Customer)
      .populate("youth", "customerName email phone")

      // Populate Course
      .populate("course", "title fees duration status")

      // Populate Payment
      .populate("payment", "mpesaCode amount status createdAt")

      .sort({ createdAt: -1 });

    const report = enrollments.map((enroll) => {
      return {
        youthId: enroll.youth?._id
          ? enroll.youth._id.toString().slice(-4)
          : null,

        youthName: enroll.youth?.customerName || "N/A",

        course: enroll.course?.title || "N/A",

        payment: {
          mpesaCode: enroll.payment?.mpesaCode || "N/A",
          amount: enroll.payment?.amount || 0,
          status: enroll.payment?.status || "N/A",
        },

        enrollmentDate: enroll.enrollmentDate,

        completionDate: enroll.completionDate,

        status: enroll.status,
      };
    });

    res.status(200).json({
      success: true,
      count: report.length,
      data: report,
    });

  } catch (error) {
    console.error("Enrollment Report Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

/**
 * GET: /api/supplies/report
 * Description: Get supply reports
 */
router.get("/supplies", async (req, res) => {
  try {
    const supplies = await SupplyRequest.find()

      // Populate Material
      .populate("material", "name unit")

      // Populate Supplier (Employee)
      .populate("supplier", "firstName lastName company")

      // Populate Supply Payment
      .populate("supplyPayment", "mpesaCode amount status paymentDate")

      .sort({ createdAt: -1 });

    const report = supplies.map((supply) => {
      return {
        supplyId: supply._id.toString().slice(-4),

        material: supply.material?.name || "N/A",

        requestDate: supply.createdAt,

        quantity: supply.quantity,

        pricePerUnit: supply.pricePerUnit,

        totalPrice: supply.totalPrice,

        supplier: supply.supplier
          ? `${supply.supplier.firstName} ${supply.supplier.lastName}`
          : "N/A",

        acceptedDate: supply.acceptanceDate || null,

        supplyPaymentId: supply.supplyPayment?._id
          ? supply.supplyPayment._id.toString().slice(-4)
          : null,

        mpesaCode: supply.supplyPayment?.mpesaCode || "N/A",
      };
    });

    res.status(200).json({
      success: true,
      count: report.length,
      data: report,
    });

  } catch (error) {
    console.error("Supply Report Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

/**
 * GET: /api/donations/report
 * Description: Get donation reports with donor info
 */
router.get("/donation", async (req, res) => {
  try {
    // Fetch all donations and populate donor details
    const donations = await Donation.find()
      .populate("donor", "firstName lastName role email phoneNumber") // get donor info
      .sort({ createdAt: -1 });

    // Map the data into report format
    const report = donations.map((donation) => {
      return {
        donationId: donation._id.toString().slice(-4),
        donor: donation.donor
          ? `${donation.donor.firstName} ${donation.donor.lastName}`
          : "N/A",
        amount: donation.amount,
        mpesaCode: donation.mpesaCode,
        donationDate: donation.createdAt,
        approvalDate: donation.approvalDate || null,
      };
    });

    res.status(200).json({
      success: true,
      count: report.length,
      data: report,
    });

  } catch (error) {
    console.error("Donation Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

/**
 * GET: /api/events/report
 * Description: Get events reports with volunteer (youth) info
 */
router.get("/events", async (req, res) => {
  try {
    const events = await Event.find()
     
      .populate({
        path: "volunteers.youth",
        select: "customerName email phone",
      })
      .sort({ startDate: -1 });

    const report = events.map((event) => {
      return {
        eventId: event._id.toString().slice(-4),
        title: event.title,
        description: event.description,
        location: event.location,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status,
        volunteers: event.volunteers.map(
          (vol) => vol.youth?.customerName || "N/A"
        ),
      };
    });

    res.status(200).json({
      success: true,
      count: report.length,
      data: report,
    });
  } catch (error) {
    console.error("Events Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

//  ________________ REPORTS DOWNLOAD APIS ____________________

/**
 * Helper to generate PDF table using pure pdfkit
 */
const generatePdfTable = (res, title, headers, rows) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: "A4" });

      // Set response headers before piping
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${title.replace(/\s+/g, "_")}.pdf"`
      );

      // Pipe the PDF to response
      doc.pipe(res);

      // Title
      doc.fontSize(18).font("Helvetica-Bold").text(title, { align: "center" });
      doc.moveDown(1);

      // Calculate column widths based on content
      const colWidths = headers.map((header, index) => {
        const maxCellWidth = Math.max(
          header.length * 7,
          ...rows.map(row => String(row[index] || "").length * 7)
        );
        return Math.min(maxCellWidth, 100); // Cap at 100px
      });

      // Draw table headers
      let x = doc.x;
      const y = doc.y;
      
      // Header background
      doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), 20)
         .fill("#2c3e50");
      
      // Header text
      doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold");
      let currentX = x;
      headers.forEach((header, i) => {
        doc.text(header, currentX + 5, y + 5, {
          width: colWidths[i] - 10,
          align: "center"
        });
        currentX += colWidths[i];
      });

      doc.moveDown(2.5);

      // Draw table rows
      doc.fillColor("#000000").fontSize(9).font("Helvetica");
      rows.forEach((row, rowIndex) => {
        const rowY = doc.y;
        
        // Alternate row colors
        if (rowIndex % 2 === 0) {
          doc.rect(x, rowY, colWidths.reduce((a, b) => a + b, 0), 15)
             .fill("#f8f9fa");
        }
        
        // Reset fill color for text
        doc.fillColor("#000000");
        
        // Draw row cells
        let cellX = x;
        row.forEach((cell, cellIndex) => {
          const cellText = String(cell || "");
          doc.text(cellText, cellX + 5, rowY + 3, {
            width: colWidths[cellIndex] - 10,
            align: "center"
          });
          cellX += colWidths[cellIndex];
        });
        
        doc.moveDown(1.8);
      });

      // Finalize PDF
      doc.end();

      // Handle stream completion
      res.on("finish", resolve);
      res.on("error", reject);
      doc.on("error", reject);

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * PDF: Youth Enrollment Report
 */
router.get("/youth-enrolment/pdf", async (req, res) => {
  try {
    const enrollments = await Enrollment.find()
      .populate("youth", "customerName email phone")
      .populate("course", "title fees duration status")
      .populate("payment", "mpesaCode amount status createdAt")
      .sort({ createdAt: -1 });

    const rows = enrollments.map((e) => [
      e.youth?._id ? e.youth._id.toString().slice(-4) : "N/A",
      e.youth?.customerName || "N/A",
      e.course?.title || "N/A",
      e.payment?.mpesaCode || "N/A",
      `Ksh ${e.payment?.amount || 0}`,
      moment(e.enrollmentDate).format("YYYY-MM-DD"),
      e.completionDate ? moment(e.completionDate).format("YYYY-MM-DD") : "N/A",
      e.status,
    ]);

    await generatePdfTable(
      res,
      "Youth Enrollment Report",
      ["ID", "Name", "Course", "MPESA", "Amount", "Enrolled", "Completed", "Status"],
      rows
    );
  } catch (err) {
    console.error("PDF Enrollment Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  }
});

/**
 * PDF: Supply Report
 */
router.get("/supplies/pdf", async (req, res) => {
  try {
    const supplies = await SupplyRequest.find()
      .populate("material", "name unit")
      .populate("supplier", "firstName lastName company")
      .populate("supplyPayment", "mpesaCode amount status paymentDate")
      .sort({ createdAt: -1 });

    const rows = supplies.map((s) => [
      s._id.toString().slice(-4),
      s.material?.name || "N/A",
      moment(s.createdAt).format("YYYY-MM-DD"),
      s.quantity,
      `Ksh ${s.pricePerUnit}`,
      `Ksh ${s.totalPrice}`,
      s.supplier ? `${s.supplier.firstName} ${s.supplier.lastName}`.substring(0, 20) : "N/A",
      s.acceptanceDate ? moment(s.acceptanceDate).format("YYYY-MM-DD") : "N/A",
      s.supplyPayment?._id ? s.supplyPayment._id.toString().slice(-4) : "N/A",
      s.supplyPayment?.mpesaCode || "N/A",
    ]);

    await generatePdfTable(
      res,
      "Supply Report",
      ["ID", "Material", "Req Date", "Qty", "Price/Unit", "Total", "Supplier", "Accepted", "Pay ID", "MPESA"],
      rows
    );
  } catch (err) {
    console.error("PDF Supply Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  }
});

/**
 * PDF: Donation Report
 */
router.get("/donations/pdf", async (req, res) => {
  try {
    const donations = await Donation.find()
      .populate("donor", "firstName lastName role email phoneNumber")
      .sort({ createdAt: -1 });

    const rows = donations.map((d) => [
      d._id.toString().slice(-4),
      d.donor ? `${d.donor.firstName} ${d.donor.lastName}`.substring(0, 25) : "N/A",
      `Ksh ${d.amount}`,
      d.mpesaCode,
      moment(d.createdAt).format("YYYY-MM-DD"),
      d.approvalDate ? moment(d.approvalDate).format("YYYY-MM-DD") : "N/A",
    ]);

    await generatePdfTable(
      res,
      "Donation Report",
      ["ID", "Donor", "Amount", "MPESA", "Donation Date", "Approval Date"],
      rows
    );
  } catch (err) {
    console.error("PDF Donation Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  }
});

/**
 * PDF: Events Report
 */
router.get("/events/pdf", async (req, res) => {
  try {
    const events = await Event.find()
      .populate({
        path: "volunteers.youth",
        select: "customerName email phone",
      })
      .sort({ startDate: -1 });

    const rows = events.map((ev) => [
      ev._id.toString().slice(-4),
      ev.title.substring(0, 20) + (ev.title.length > 20 ? "..." : ""),
      ev.description ? ev.description.substring(0, 25) + (ev.description.length > 25 ? "..." : "") : "N/A",
      ev.location ? ev.location.substring(0, 15) : "N/A",
      moment(ev.startDate).format("YYYY-MM-DD"),
      moment(ev.endDate).format("YYYY-MM-DD"),
      ev.status,
      ev.volunteers.map((v) => v.youth?.customerName || "N/A").join(", ").substring(0, 30) + (ev.volunteers.length > 0 && ev.volunteers.map(v => v.youth?.customerName).join(", ").length > 30 ? "..." : ""),
    ]);

    await generatePdfTable(
      res,
      "Events Report",
      ["ID", "Title", "Description", "Location", "Start Date", "End Date", "Status", "Volunteers"],
      rows
    );
  } catch (err) {
    console.error("PDF Events Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Server Error" });
    }
  }
});

module.exports = router;
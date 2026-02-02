const express = require("express");
const router = express.Router();
const Enrollment = require("../models/Enrollment");
const SupplyRequest = require("../models/SupplyRequest");
const Donation = require("../models/Donation"); 
const Employee = require("../models/Employee");
const Event = require("../models/CommunityService"); 
const Customer = require("../models/Customer")


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
module.exports = router;

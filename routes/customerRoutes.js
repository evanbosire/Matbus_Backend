const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
require('dotenv').config();

// Fetch customers by status
router.get("/:status", async (req, res) => {
  try {
    const customers = await Customer.find({ status: req.params.status });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve a customer
router.patch("/approve/:id", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    customer.status = "active"; // Update status to active
    await customer.save();

    res.status(200).json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Suspend a customer
router.patch("/suspend/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findByIdAndUpdate(
      id,
      { status: "suspended" },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.status(200).json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Reactivate customer endpoint
router.patch("/reactivate/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Reactivation logic here
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    customer.status = "active"; // Example logic
    await customer.save();

    res.status(200).json(customer);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
// Example route for rejecting a customer
router.patch("/reject/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    customer.status = "rejected"; // Adjust status according to your implementation
    await customer.save();
    res.status(200).json(customer);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/revert/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    customer.status = "pending"; // Set status to pending
    await customer.save();

    res.status(200).json(customer); // Return the updated customer
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get count of pending customers
router.get("/counts/pending", async (req, res) => {
  try {
    const count = await Customer.countDocuments({ status: "pending" });
    res.json({ pending: count });
  } catch (error) {
    console.error("Error fetching pending customer count:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to get count of active customers
router.get("/counts/active", async (req, res) => {
  try {
    const count = await Customer.countDocuments({ status: "active" });
    res.json({ active: count });
  } catch (error) {
    console.error("Error fetching active customer count:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to get count of suspended customers
router.get("/counts/suspended", async (req, res) => {
  try {
    const count = await Customer.countDocuments({ status: "suspended" });
    res.json({ suspended: count });
  } catch (error) {
    console.error("Error fetching suspended customer count:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to get count of rejected customers
router.get("/counts/rejected", async (req, res) => {
  try {
    const count = await Customer.countDocuments({ status: "rejected" });
    res.json({ rejected: count });
  } catch (error) {
    console.error("Error fetching rejected customer count:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// To update the admin UI whenever a change is made, i will use SSE Endpoint.

// SSE endpoint
let clients = [];

const sendUpdateEvent = async () => {
  const data = {
    pending: await Customer.countDocuments({ status: "pending" }),
    active: await Customer.countDocuments({ status: "active" }),
    suspended: await Customer.countDocuments({ status: "suspended" }),
    rejected: await Customer.countDocuments({ status: "rejected" }),
  };

  clients.forEach((client) =>
    client.res.write(`data: ${JSON.stringify(data)}\n\n`)
  );
};

router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  clients.push({ res });

  req.on("close", () => {
    clients = clients.filter((client) => client.res !== res);
  });
});

// function to send verification email the user

const sendVerificationEmail = async (email, verificationToken) => {
  // create a nodemailer transport

  const transporter = nodemailer.createTransport({
    // config the email service
    service: "gmail",
    auth: {
      user: "evanbosire422@gmail.com",
      pass: "suxe ceeb btev iqth",
    },
  });

  // compose the email message
  const mailOptions = {
    from: "corrugatedsheetsltd.com",
    to: email,
    subject: "Email Verification",
    text: `Please click the following link to verify your email: https://backend-n0lb.onrender.com/api/customers/verify/${verificationToken}
`,
  };

  // send the email

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log("Error sending verification email", error);
  }
};

// sign up into the db
router.post("/signup", async (req, res) => {
  const { customerName, gender, phone, email, password, location } = req.body;

  try {
    // Check if the email already exists
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Create a new customer without hashing the password
    const newCustomer = new Customer({
      customerName,
      gender,
      phone,
      email,
      password, // Store the plain text password
      location,
      status: "pending",
    });

    // generate and store a verification token.
    newCustomer.verificationToken = crypto.randomBytes(20).toString("hex");
    // Save to database
    await newCustomer.save();

    // send a verification email to the user
    sendVerificationEmail(newCustomer.email, newCustomer.verificationToken);
    res.status(201).json({
      message: "Customer created successfully!",
      customer: newCustomer,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create customer", error: error.message });
  }
});

// Endpoint to verify the email

router.get("/verify/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const customer = await Customer.findOne({ verificationToken: token });

    if (!customer) {
      return res.status(404).json({ message: "Invalid verification token" });
    }

    customer.verified = true;
    customer.verificationToken = undefined; // Clear token after verification
    await customer.save();

    res.status(200).json({
      message: "Email Verified Successfully!",
    });
  } catch (error) {
    res.status(500).json({ message: "Email Verification Failed" });
  }
});

const generateSecretKey = () => {
  const secretKey = crypto.randomBytes(32).toString("hex");
  return secretKey;
};
const secretKey = generateSecretKey();

// // POST /api/customer/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const customer = await Customer.findOne({ email });
    if (!customer || customer.password !== password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (customer.status !== "active") {
      return res.status(403).json({ message: "Account not approved" });
    }

    const token = jwt.sign(
      { customerId: customer._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({ token, message: "Login successful" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Endpoint to store a new address to the backend
router.post("/addresses", async (req, res) => {
  try {
    const { userId, address } = req.body;

    // Check if both userId and address are provided
    if (!userId || !address) {
      return res
        .status(400)
        .json({ message: "User ID and address are required" });
    }

    // Find the customer by userId
    const customer = await Customer.findById(userId);
    if (!customer) {
      return res.status(404).json({ message: "User not found!" });
    }

    // Add the new address to the customer's addresses array
    customer.addresses.push(address);

    // Save the updated customer in the database
    await customer.save();

    // Respond with a success message or the updated customer data
    res.status(200).json({ message: "Address created successfully", customer });
  } catch (error) {
    console.error("Error adding address:", error);
    res
      .status(500)
      .json({ message: "Error adding address", error: error.message });
  }
});
// Endpoint to get all the addresses of the customer
router.get("/addresses/:customerId", async (req, res) => {
  try {
    const customerId = req.params.customerId;

    // Assuming Customer is the model for customers
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found!" });
    }

    const addresses = customer.addresses;
    res.status(200).json(addresses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving the addresses" });
  }
});

// Fetch the number of customers with status "pending"
router.get("/customer-counts/pending", async (req, res) => {
  try {
    const pendingCount = await Customer.countDocuments({ status: "pending" });

    res.json({ pending: pendingCount });
  } catch (error) {
    console.error("Error fetching pending customers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// Fetch the number of customers with status "active"
router.get("/customer-counts/active", async (req, res) => {
  try {
    const activeCount = await Customer.countDocuments({ status: "active" });

    res.json({ active: activeCount });
  } catch (error) {
    console.error("Error fetching active customers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// Fetch the number of customers with status "suspended"
router.get("/customer-counts/suspended", async (req, res) => {
  try {
    const suspendedCount = await Customer.countDocuments({
      status: "suspended",
    });

    res.json({ suspended: suspendedCount });
  } catch (error) {
    console.error("Error fetching suspended customers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// Fetch the number of customers with status "rejected"
router.get("/customer-counts/rejected", async (req, res) => {
  try {
    const rejectedCount = await Customer.countDocuments({
      status: "rejected",
    });

    res.json({ rejected: rejectedCount });
  } catch (error) {
    console.error("Error fetching rejected customers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

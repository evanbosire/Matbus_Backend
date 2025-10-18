const express = require("express");
const Admin = require("../models/Admin"); 
const router = express.Router();

// Admin Registration Route
router.post("/register", async (req, res) => {
  const { id, name, email, password, phone } = req.body;

  try {
   
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Create a new admin record
    const newAdmin = new Admin({
      id,
      name,
      email,
      password, 
      phone,
    });

    await newAdmin.save();
    res.status(201).json({ message: "Admin registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error registering admin", error });
  }
});

// Admin Login Route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Login request received:", email); 

  try {
    // Find the admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.log("Admin not found:", email); 
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Compare the plain-text password directly
    if (password !== admin.password) {
      console.log("Invalid password for:", email); 
      return res.status(400).json({ message: "Invalid email or password" });
    }

    console.log("Login successful for:", email); 
    res.json({ message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error); 
    res.status(500).json({ message: "Error logging in", error });
  }
});

module.exports = router;

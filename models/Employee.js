const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  role: {
    type: String,
    required: true,
    enum: ["finance_manager", "service_manager", "trainer", "inventory_manager", 
           "supplier", "duties_manager", "community_service_coordinator", "mentor"]
  },
  county: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  password: {
    type: String,
    required: true,
  },
  specialization: String,
  company: String,
  isAvailable: {
    type: Boolean,
    default: true
  }
});

const Employee = mongoose.model("Employee", EmployeeSchema);

module.exports = Employee;
const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  location: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "active", "suspended", "rejected"],
    default: "pending",
  },
  password: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  role: {
    type: String,
    default: "youth"
  },
  addresses: [
    {
      name: String,
      mobileNo: String,
      houseNo: String,
      street: String,
      landmark: String,
      city: String,
      county: String,
      postalCode: String,
    },
  ],
  orders: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "Order",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Customer = mongoose.model("Customer", CustomerSchema);

module.exports = Customer;
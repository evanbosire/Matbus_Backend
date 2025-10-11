const mongoose = require("mongoose");

const supplyPaymentSchema = new mongoose.Schema(
  {
    mpesaCode: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) =>
          /^[A-Z1-9]{10}$/.test(v.toUpperCase()) &&
          v.split("").filter((c) => /[1-9]/.test(c)).length === 3 &&
          v.split("").filter((c) => /[A-Z]/.test(c)).length === 7,
        message:
          "mpesaCode must be 10 chars long, contain 3 digits (1-9) and 7 uppercase letters (no zeros)",
      },
      set: (v) => v.toUpperCase(),
    },
    amount: { type: Number, required: true },
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    relatedSupplyRequests: [
      { type: mongoose.Schema.Types.ObjectId, ref: "SupplyRequest" },
    ],
    status: {
      type: String,
      enum: ["paid", "verified", "failed"],
      default: "paid",
    },
    paymentDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupplyPayment", supplyPaymentSchema);

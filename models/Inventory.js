const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingMaterial",
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    minStockLevel: { type: Number, default: 5 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inventory", inventorySchema);

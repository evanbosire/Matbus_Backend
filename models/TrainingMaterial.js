const mongoose = require("mongoose");

const trainingMaterialSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  unit: { type: String, required: true },
});

module.exports = mongoose.model("TrainingMaterial", trainingMaterialSchema);

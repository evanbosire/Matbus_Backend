const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  title: String,
  pricePerHour: Number,
  description: String
});

module.exports = mongoose.model('Service', serviceSchema);
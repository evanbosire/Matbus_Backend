const express = require('express');
const router = express.Router();
const TrainingMaterial = require('../models/TrainingMaterial');

// 🧠 Seed default materials (run once)
router.post('/seed-materials', async (req, res) => {
  try {
    const materials = [
      { name: "Laptop", unit: "pieces" },
      { name: "Desktop Computer", unit: "pieces" },
      { name: "Computer Mouse", unit: "pieces" },
      { name: "Keyboard", unit: "pieces" },
      { name: "Headset", unit: "pieces" },
      { name: "Projector", unit: "pieces" },
      { name: "Projector Screen", unit: "pieces" },
      { name: "Whiteboard", unit: "pieces" },
      { name: "Flip Chart Stand", unit: "pieces" },
      { name: "Whiteboard Markers", unit: "boxes" },
      { name: "Pens", unit: "packs" },
      { name: "Notebooks", unit: "packs" },
      { name: "Sticky Notes", unit: "packs" },
      { name: "Drawing Tablet", unit: "pieces" },
      { name: "Stylus Pen", unit: "pieces" },
      { name: "High Resolution Monitor", unit: "pieces" },
      { name: "Color Printer", unit: "pieces" },
      { name: "Android Test Phone", unit: "pieces" },
      { name: "iOS Test Phone", unit: "pieces" },
      { name: "Charging Cable", unit: "pieces" },
      { name: "Power Adapter", unit: "pieces" },
      { name: "Router", unit: "pieces" },
      { name: "Network Switch", unit: "pieces" },
      { name: "Ethernet Cable", unit: "meters" },
      { name: "Patch Panel", unit: "pieces" },
      { name: "Crimping Tool", unit: "pieces" },
      { name: "USB Drive", unit: "pieces" },
      { name: "External Hard Drive", unit: "pieces" },
      { name: "Printed Sample Data Set", unit: "packs" },
      { name: "Wi-Fi Router", unit: "pieces" },
      { name: "Extension Cord", unit: "pieces" },
      { name: "Power Strip", unit: "pieces" },
      { name: "HDMI Cable", unit: "pieces" },
      { name: "VGA Cable", unit: "pieces" },
      { name: "Flip Chart Paper", unit: "reams" },
      { name: "Training Handout", unit: "packs" },
    ];

    const inserted = [];

    for (const mat of materials) {
      const existing = await TrainingMaterial.findOne({ name: mat.name });
      if (!existing) {
        const newMat = new TrainingMaterial(mat);
        await newMat.save();
        inserted.push(newMat);
      }
    }

    res.json({ message: 'Training materials seeded successfully', inserted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📦 Get all training materials
router.get('/', async (req, res) => {
  try {
    const materials = await TrainingMaterial.find().sort({ name: 1 });
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
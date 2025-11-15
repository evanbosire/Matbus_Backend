const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const path = require('path');


const customerRoutes = require("./routes/customerRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const adminRoutes = require("./routes/adminRoutes"); // Admin routes for login and registration

// Import routes
const youthRoutes = require('./routes/youth');
const financeRoutes = require('./routes/finance');
const serviceManagerRoutes = require('./routes/serviceManager');
const inventoryRoutes = require('./routes/inventory');
const trainerRoutes = require('./routes/trainer');
const supplierRoutes = require('./routes/supplier');
const communityServiceRoutes = require('./routes/communityService');
const donorRoutes = require('./routes/donor');
const mentorRoutes = require('./routes/mentor');
const materialRoutes = require('./routes/materialRequests');
const dutiesManagerRoutes = require('./routes/dutiesManager');

// const authRoutes = require('./routes/auth');

const app = express();
const port = process.env.PORT || 5000; // Use the environment PORT variable

// MongoDB connection using environment variable
const uri = process.env.MONGO_URL;
mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));


// Enable CORS for specific origin (your frontend)
app.use(cors());

app.use(bodyParser.json());

// Basic root route
app.get("/", (req, res) => {
  res.send("MATBUS Backend API is running!"); // Change this to your preferred response
});

// Use routes
app.use("/api/customers", customerRoutes);
app.use("/api", employeeRoutes);
app.use("/api/admin", adminRoutes); // Admin routes for login and registration


// Use routes
// app.use('/api/auth', authRoutes);
app.use('/api/youth', youthRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/service-manager', serviceManagerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/trainer', trainerRoutes);
app.use('/api/supplier', supplierRoutes);
app.use('/api/community-service', communityServiceRoutes);
app.use('/api/donor', donorRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/material-request', materialRoutes)

// seed training materials to DB once
app.use('/api/training-materials', require('./routes/trainingMaterials'));

// serve everything in /certificates publicly
app.use('/certificates', express.static(path.join(__dirname, 'certificates')));


// ******* community service flow **************

app.use('/api/duties-manager', dutiesManagerRoutes)
// -> youth apis comes here to view available duties




app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

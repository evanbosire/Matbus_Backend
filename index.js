const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cookieParser  = require("cookie-parser");
const cors = require("cors");
require("dotenv").config();
const path = require("path");
const customerRoutes = require("./routes/customerRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const adminRoutes = require("./routes/adminRoutes"); // Admin routes for login and registration
const serviceRoutes = require('./routes/servicesRoutes');
const bookingRoutes = require('./routes/bookingsRoutes');

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
app.use(cookieParser());

// Basic root route
app.get("/", (req, res) => {
  res.send("Welcome to the API! Aora.Dev"); // Change this to your preferred response
});

// Use routes
app.use("/api/customers", customerRoutes);
app.use("/api", employeeRoutes);
app.use("/api/admin", adminRoutes); // Admin routes for login and registration
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);

app.use('/receipts', express.static(path.join(__dirname, 'public/receipts')));


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

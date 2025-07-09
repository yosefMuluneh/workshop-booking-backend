// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const workshopRoutes = require('./src/routes/workshopRoutes')
const bookingRoutes = require('./src/routes/bookingRoutes');
const statsRoutes = require('./src/routes/statsRoutes');
const timeSlotRoutes = require('./src/routes/timeSlotRoutes');

const app = express();

// Core Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(helmet()); // Set various security headers
app.use(express.json()); // Parse JSON bodies
app.use(morgan('dev')); // Logger for development

// Rate Limiting
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after an hour',
});
app.use(limiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workshops', workshopRoutes)
app.use('/api/bookings', bookingRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/timeslots', timeSlotRoutes);

// Simple welcome route
app.get('/', (req, res) => {
  res.send('Workshop Booking System API is running!');
});

// Global Error Handler (simple version)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app
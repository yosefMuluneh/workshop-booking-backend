// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const workshopRoutes = require('./src/routes/workshopRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const statsRoutes = require('./src/routes/statsRoutes');
const timeSlotRoutes = require('./src/routes/timeSlotRoutes');

const app = express();

const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...configuredOrigins,
]);

// Allow local development origins by default. Add deployed frontend origins
// through CORS_ORIGINS (comma-separated) in the backend environment.
app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header (e.g. server-to-server and CLI tools)
    // are not subject to browser CORS enforcement.
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP. Please try again later.' },
});
app.use(limiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workshops', workshopRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/timeslots', timeSlotRoutes);

app.get('/', (req, res) => {
  res.send('Workshop Booking System API is running!');
});

// Centralized error handler. Never send internal error details to clients.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = Number.isInteger(err.status) && err.status >= 400 && err.status < 500
    ? err.status
    : 500;

  if (statusCode >= 500) {
    console.error('Unhandled API error:', err);
  }

  return res.status(statusCode).json({
    message: statusCode === 400 ? 'Invalid request.' : 'Something went wrong.',
  });
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;

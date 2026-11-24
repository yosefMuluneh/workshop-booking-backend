// src/routes/bookingRoutes.js
const express = require('express');
const {
    getAllBookings,
    getMyBookings,
    getDashboardStats
} = require('../controllers/bookingController');
const {
    createBooking,
    updateBookingStatus,
    cancelMyBooking
} = require('../controllers/bookingMutationController');
const { protect, isAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

// -- Customer Routes --
router.post('/', protect, createBooking);
router.get('/my-bookings', protect, getMyBookings);
router.put('/my-bookings/:id/cancel', protect, cancelMyBooking);

// -- Admin Routes --
router.get('/', protect, isAdmin, getAllBookings);
router.put('/:id', protect, isAdmin, updateBookingStatus);

module.exports = router;

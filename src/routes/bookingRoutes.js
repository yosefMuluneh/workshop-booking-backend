// src/routes/bookingRoutes.js
const express = require('express');
const {
    createBooking,
    getAllBookings,
    updateBookingStatus,
    getMyBookings,
    cancelMyBooking,
    getDashboardStats // Importing stats controller here for convenience
} = require('../controllers/bookingController');
const { protect, isAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

// -- Customer Route --
// Any logged-in user can create a booking
router.post('/', protect, createBooking);
router.get('/my-bookings', protect, getMyBookings);
router.put('/my-bookings/:id/cancel', protect, cancelMyBooking);
// -- Admin Routes --
// Only admins can view all bookings and update status
router.get('/', protect, isAdmin, getAllBookings);
router.put('/:id', protect, isAdmin, updateBookingStatus);


module.exports = router;
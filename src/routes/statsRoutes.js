// src/routes/statsRoutes.js
const express = require('express');
const { getDashboardStats } = require('../controllers/bookingController');
const { protect, isAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

// All stats routes are for admins only
router.use(protect, isAdmin);

router.get('/', getDashboardStats);

module.exports = router;
// src/routes/timeSlotRoutes.js
const express = require('express');
const { addTimeSlot, updateTimeSlot, deleteTimeSlot } = require('../controllers/timeSlotController');
const { protect, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// All these routes are for admins only
router.use(protect, isAdmin);

router.post('/:workshopId', addTimeSlot);
router.put('/:id', updateTimeSlot);
router.delete('/:id', deleteTimeSlot);

module.exports = router;
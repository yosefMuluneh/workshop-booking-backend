// src/routes/workshopRoutes.js
const express = require('express');
const {
  createWorkshop,
  getPublicWorkshops,
  getAdminWorkshops,
  softDeleteWorkshop,
  restoreWorkshop,
  getWorkshopById
} = require('../controllers/workshopController');
const { protect, isAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

// --- PUBLIC ROUTE ---
// Anyone can view available workshops
router.get('/', getPublicWorkshops);


// --- ADMIN ROUTES ---
// Must be logged in and an admin to access these
router.post('/', protect, isAdmin, createWorkshop);
router.get('/admin', protect, isAdmin, getAdminWorkshops);
router.put('/:id/restore', protect, isAdmin, restoreWorkshop);

// General dynamic routes last
router.get('/:id', protect, isAdmin, getWorkshopById);
router.delete('/:id', protect, isAdmin, softDeleteWorkshop);
// router.put('/:id', protect, isAdmin, updateWorkshop); // Placeholder for update

module.exports = router;
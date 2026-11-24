// src/validation/bookingValidation.js
const { z } = require('zod');

// Schema for a customer creating a new booking
const createBookingSchema = z.object({
  workshopId: z.cuid({ error: 'Invalid Workshop ID' }),
  timeSlotId: z.cuid({ error: 'Invalid Time Slot ID' }),
});

// Schema for an admin updating a booking's status
const updateBookingStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELED'], {
    error: 'Status must be one of: PENDING, CONFIRMED, CANCELED',
  }),
});

module.exports = {
  createBookingSchema,
  updateBookingStatusSchema,
};
// src/validation/bookingValidation.js
const { z } = require('zod');

// Schema for a customer creating a new booking
const createBookingSchema = z.object({
  workshopId: z.string().cuid({ message: "Invalid Workshop ID" }),
  timeSlotId: z.string().cuid({ message: "Invalid Time Slot ID" }),
});

// Schema for an admin updating a booking's status
const updateBookingStatusSchema = z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'CANCELED'], {
        errorMap: () => ({ message: "Status must be one of: PENDING, CONFIRMED, CANCELED" })
    })
});

module.exports = {
  createBookingSchema,
  updateBookingStatusSchema,
};
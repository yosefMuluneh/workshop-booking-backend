// src/validation/workshopValidation.js
const { z } = require('zod');

// Schema for a single time slot during workshop creation
const timeSlotSchema = z.object({
  startTime: z.string().regex(/^\d{1,2}:\d{2}\s(AM|PM)$/, "Start time must be in 'HH:MM AM/PM' format"),
  endTime: z.string().regex(/^\d{1,2}:\d{2}\s(AM|PM)$/, "End time must be in 'HH:MM AM/PM' format"),
});

// Schema for creating a new workshop
const createWorkshopSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long'),
  description: z.string().min(10, 'Description must be at least 10 characters long'),
  date: z.string().datetime({ message: "Invalid date format. Use ISO 8601 format." }), // e.g., "2025-07-10T00:00:00.000Z"
  maxCapacity: z.number().int().positive('Max capacity must be a positive integer'),
  timeSlots: z.array(timeSlotSchema).min(1, 'At least one time slot is required'),
});

module.exports = {
  createWorkshopSchema,
};
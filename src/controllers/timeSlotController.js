// src/controllers/timeSlotController.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED'];
const TIME_PATTERN = /^\d{1,2}:\d{2}\s(AM|PM)$/;

exports.addTimeSlot = async (req, res) => {
  const { workshopId } = req.params;
  const { startTime, endTime } = req.body;

  if (typeof startTime !== 'string' || !TIME_PATTERN.test(startTime) ||
      typeof endTime !== 'string' || !TIME_PATTERN.test(endTime)) {
    return res.status(400).json({ message: 'Start and end times must use HH:MM AM/PM format.' });
  }

  try {
    const workshop = await prisma.workshop.findFirst({
      where: { id: workshopId, deletedAt: null },
    });

    if (!workshop) {
      return res.status(404).json({ message: 'Active workshop not found.' });
    }

    const newTimeSlot = await prisma.timeSlot.create({
      data: {
        startTime,
        endTime,
        availableSpots: workshop.maxCapacity,
        workshopId,
      },
    });

    return res.status(201).json(newTimeSlot);
  } catch (error) {
    console.error('Add time slot failed:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.updateTimeSlot = async (req, res) => {
  const { id } = req.params;
  const { startTime, endTime, availableSpots } = req.body;

  if (startTime !== undefined && (typeof startTime !== 'string' || !TIME_PATTERN.test(startTime))) {
    return res.status(400).json({ message: 'Start time must use HH:MM AM/PM format.' });
  }
  if (endTime !== undefined && (typeof endTime !== 'string' || !TIME_PATTERN.test(endTime))) {
    return res.status(400).json({ message: 'End time must use HH:MM AM/PM format.' });
  }

  let parsedAvailableSpots;
  if (availableSpots !== undefined) {
    parsedAvailableSpots = Number(availableSpots);
    if (!Number.isInteger(parsedAvailableSpots) || parsedAvailableSpots < 0) {
      return res.status(400).json({ message: 'Available spots must be a non-negative integer.' });
    }
  }

  if (startTime === undefined && endTime === undefined && parsedAvailableSpots === undefined) {
    return res.status(400).json({ message: 'At least one time slot field must be provided.' });
  }

  try {
    const updatedTimeSlot = await prisma.$transaction(async (tx) => {
      const slot = await tx.timeSlot.findUnique({
        where: { id },
        include: { workshop: { select: { maxCapacity: true } } },
      });

      if (!slot) {
        const error = new Error('Time slot not found.');
        error.statusCode = 404;
        throw error;
      }

      if (parsedAvailableSpots !== undefined) {
        const activeBookings = await tx.booking.count({
          where: {
            timeSlotId: id,
            deletedAt: null,
            status: { in: ACTIVE_BOOKING_STATUSES },
          },
        });

        if (parsedAvailableSpots + activeBookings > slot.workshop.maxCapacity) {
          const error = new Error('Available spots plus active bookings cannot exceed workshop capacity.');
          error.statusCode = 409;
          throw error;
        }
      }

      return tx.timeSlot.update({
        where: { id },
        data: {
          ...(startTime !== undefined && { startTime }),
          ...(endTime !== undefined && { endTime }),
          ...(parsedAvailableSpots !== undefined && { availableSpots: parsedAvailableSpots }),
        },
      });
    }, {
      isolationLevel: 'Serializable',
    });

    return res.status(200).json(updatedTimeSlot);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error.code === 'P2034') {
      return res.status(409).json({ message: 'The slot changed while being updated. Refresh and try again.' });
    }
    console.error('Update time slot failed:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteTimeSlot = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.$transaction(async (tx) => {
      const slot = await tx.timeSlot.findUnique({ where: { id } });
      if (!slot) {
        const error = new Error('Time slot not found.');
        error.statusCode = 404;
        throw error;
      }

      // Preserve booking history: deleting a slot cascades through its bookings.
      const bookingCount = await tx.booking.count({
        where: { timeSlotId: id },
      });

      if (bookingCount > 0) {
        const error = new Error('Cannot delete a time slot that has booking history.');
        error.statusCode = 409;
        throw error;
      }

      await tx.timeSlot.delete({ where: { id } });
    }, {
      isolationLevel: 'Serializable',
    });

    return res.status(200).json({ message: 'Time slot deleted successfully' });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error.code === 'P2034') {
      return res.status(409).json({ message: 'The slot changed while being deleted. Refresh and try again.' });
    }
    console.error('Delete time slot failed:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

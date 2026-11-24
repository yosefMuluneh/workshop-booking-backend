const { PrismaClient } = require('@prisma/client');
const { createBookingSchema, updateBookingStatusSchema } = require('../validation/bookingValidation');

const prisma = new PrismaClient();

class BookingOperationError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'BookingOperationError';
    this.statusCode = statusCode;
  }
}

const isTransactionConflict = (error) => error && error.code === 'P2034';

exports.createBooking = async (req, res) => {
  try {
    const { workshopId, timeSlotId } = createBookingSchema.parse(req.body);
    const userId = req.user.userId;

    const booking = await prisma.$transaction(async (tx) => {
      const timeSlot = await tx.timeSlot.findUnique({
        where: { id: timeSlotId },
      });

      if (!timeSlot) {
        throw new BookingOperationError('Time slot not found.', 404);
      }

      if (timeSlot.workshopId !== workshopId) {
        throw new BookingOperationError('Time slot does not belong to the specified workshop.', 400);
      }

      const workshop = await tx.workshop.findUnique({
        where: { id: workshopId },
        select: { date: true, deletedAt: true },
      });

      if (!workshop || workshop.deletedAt || workshop.date < new Date()) {
        throw new BookingOperationError('This workshop is not available for booking.', 400);
      }

      const existingBooking = await tx.booking.findFirst({
        where: {
          userId,
          timeSlotId,
          deletedAt: null,
          status: { not: 'CANCELED' },
        },
        select: { id: true },
      });

      if (existingBooking) {
        throw new BookingOperationError('You have already booked this time slot.', 409);
      }

      // Conditional update makes the capacity decrement atomic. Concurrent requests
      // cannot both consume the final available spot.
      const capacityUpdate = await tx.timeSlot.updateMany({
        where: {
          id: timeSlotId,
          availableSpots: { gt: 0 },
        },
        data: { availableSpots: { decrement: 1 } },
      });

      if (capacityUpdate.count !== 1) {
        throw new BookingOperationError('No available spots for this time slot.', 409);
      }

      return tx.booking.create({
        data: { userId, workshopId, timeSlotId },
      });
    }, {
      isolationLevel: 'Serializable',
    });

    return res.status(201).json({
      message: 'Booking successful',
      bookingId: booking.id,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error instanceof BookingOperationError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (isTransactionConflict(error)) {
      return res.status(409).json({
        message: 'The booking could not be completed because availability changed. Please try again.',
      });
    }
    console.error('Create booking failed:', error);
    return res.status(500).json({ message: 'Server error while creating booking.' });
  }
};

exports.cancelMyBooking = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const canceledBooking = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
      });

      // Do not reveal whether another customer's booking exists.
      if (!booking || booking.userId !== userId || booking.deletedAt) {
        throw new BookingOperationError('Booking not found.', 404);
      }

      if (booking.status === 'CANCELED') {
        throw new BookingOperationError('This booking has already been canceled.', 409);
      }

      // Claim the state transition before restoring capacity. The conditional
      // update prevents concurrent cancellation requests from restoring twice.
      const transition = await tx.booking.updateMany({
        where: {
          id,
          userId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          deletedAt: null,
        },
        data: { status: 'CANCELED' },
      });

      if (transition.count !== 1) {
        throw new BookingOperationError('This booking can no longer be canceled.', 409);
      }

      await tx.timeSlot.update({
        where: { id: booking.timeSlotId },
        data: { availableSpots: { increment: 1 } },
      });

      return tx.booking.findUnique({ where: { id } });
    }, {
      isolationLevel: 'Serializable',
    });

    return res.status(200).json({
      message: 'Booking canceled successfully',
      booking: canceledBooking,
    });
  } catch (error) {
    if (error instanceof BookingOperationError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (isTransactionConflict(error)) {
      return res.status(409).json({
        message: 'The booking changed while cancellation was being processed. Please try again.',
      });
    }
    console.error('Cancel booking failed:', error);
    return res.status(500).json({ message: 'Server error while canceling booking.' });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = updateBookingStatusSchema.parse(req.body);

    const updatedBooking = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });

      if (!booking || booking.deletedAt) {
        throw new BookingOperationError('Booking not found.', 404);
      }

      if (booking.status === status) {
        return booking;
      }

      const wasActive = ['PENDING', 'CONFIRMED'].includes(booking.status);
      const willBeActive = ['PENDING', 'CONFIRMED'].includes(status);

      if (wasActive && !willBeActive) {
        await tx.timeSlot.update({
          where: { id: booking.timeSlotId },
          data: { availableSpots: { increment: 1 } },
        });
      } else if (!wasActive && willBeActive) {
        const capacityUpdate = await tx.timeSlot.updateMany({
          where: {
            id: booking.timeSlotId,
            availableSpots: { gt: 0 },
          },
          data: { availableSpots: { decrement: 1 } },
        });

        if (capacityUpdate.count !== 1) {
          throw new BookingOperationError('There are no available spots to reactivate this booking.', 409);
        }
      }

      const transition = await tx.booking.updateMany({
        where: { id, status: booking.status, deletedAt: null },
        data: { status },
      });

      if (transition.count !== 1) {
        throw new BookingOperationError('The booking status changed. Refresh and try again.', 409);
      }

      return tx.booking.findUnique({ where: { id } });
    }, {
      isolationLevel: 'Serializable',
    });

    return res.status(200).json({
      message: 'Booking status updated',
      booking: updatedBooking,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error instanceof BookingOperationError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (isTransactionConflict(error)) {
      return res.status(409).json({
        message: 'The booking changed while this update was being processed. Refresh and try again.',
      });
    }
    console.error('Update booking status failed:', error);
    return res.status(500).json({ message: 'Server error while updating booking status.' });
  }
};

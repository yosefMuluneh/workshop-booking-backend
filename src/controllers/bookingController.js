// src/controllers/bookingController.js
const { PrismaClient } = require('@prisma/client');
const { createBookingSchema, updateBookingStatusSchema } = require('../validation/bookingValidation');
const { stat } = require('fs');

const prisma = new PrismaClient();

// @desc    Create a new booking (Customer)
// @route   POST /api/bookings
// @access  Private/Customer
exports.createBooking = async (req, res) => {
  try {
    const { workshopId, timeSlotId } = createBookingSchema.parse(req.body);
    const userId = req.user.userId; // From 'protect' middleware

    const existingBooking = await prisma.booking.findFirst({
      where: {
        userId: userId,
        timeSlotId: timeSlotId,
        // Optional: you might want to exclude canceled bookings from this check
        status: { not: 'CANCELED' } 
      },
    });

    if (existingBooking) {
      // Return a specific, user-friendly error message.
      return res.status(409).json({ message: 'You have already booked this time slot.' }); // 409 Conflict is a great status code for this.
    }

    // **CRITICAL: Use a transaction to ensure atomicity**
    // This makes sure that we only create a booking IF we can successfully decrement the spots.
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find the time slot and lock it for update to prevent race conditions
      const timeSlot = await tx.timeSlot.findUnique({
        where: { id: timeSlotId },
      });

      if (!timeSlot) {
        throw new Error('Time slot not found.');
      }
      if (timeSlot.availableSpots <= 0) {
        throw new Error('No available spots for this time slot.');
      }
      if (timeSlot.workshopId !== workshopId) {
        throw new Error('Time slot does not belong to the specified workshop.');
      }

      // 2. Decrement the available spots
      await tx.timeSlot.update({
        where: { id: timeSlotId },
        data: { availableSpots: { decrement: 1 } },
      });

      // 3. Create the booking
      const newBooking = await tx.booking.create({
        data: {
          userId,
          workshopId,
          timeSlotId,
          // Status defaults to PENDING based on schema
        },
      });

      return newBooking;
    });

    res.status(201).json({ message: 'Booking successful', bookingId: result.id });
  } catch (error) {
    if (error instanceof require('zod').ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    // Custom error messages from the transaction
    if (error.message.includes('No available spots') || error.message.includes('Time slot not found')) {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


// @desc    Get all bookings (Admin only) with filtering and pagination
// @route   GET /api/bookings
// @access  Private/Admin
exports.getAllBookings = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const skip = (page - 1) * limit;

        const whereClause = {
            deletedAt: null // Exclude soft-deleted bookings
        };
        // If a specific status is NOT provided in the query string,
        // we default to showing only PENDING and CONFIRMED bookings.
        if (status && ['PENDING', 'CONFIRMED', 'CANCELED'].includes(status.toUpperCase())) {
            whereClause.status = status.toUpperCase();
        } else {
            // By default, filter out CANCELED bookings
            whereClause.status = {
                in: ['PENDING', 'CONFIRMED']
            };
        }

        const bookings = await prisma.booking.findMany({
            where: whereClause,
            skip: parseInt(skip),
            take: parseInt(limit),
            include: {
                user: { select: { name: true, email: true } },
                workshop: { select: { title: true } },
                timeSlot: { select: { startTime: true, endTime: true } }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const totalBookings = await prisma.booking.count({ where: whereClause });

        res.status(200).json({
            data: bookings,
            pagination: {
                total: totalBookings,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalBookings / limit)
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};


// @desc    Update a booking's status (Admin only)
// @route   PUT /api/bookings/:id
// @access  Private/Admin
exports.updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = updateBookingStatusSchema.parse(req.body);

        const updatedBooking = await prisma.booking.update({
            where: { id },
            data: { status },
        });

        res.status(200).json({ message: 'Booking status updated', booking: updatedBooking });
    } catch (error) {
        if (error instanceof require('zod').ZodError) {
            return res.status(400).json({ message: 'Validation failed', errors: error.errors });
        }
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get dashboard statistics (Admin only)
// @route   GET /api/stats
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
    try {
        const whereClause = {
            deletedAt: null 
        };
        
        whereClause.status = {
            in: ['PENDING', 'CONFIRMED']
        };
        const totalBookings = await prisma.booking.count({ where: whereClause });
        const totalWorkshops = await prisma.workshop.count({ where: { deletedAt: null, date : {gte: new Date()} } });
        console.log(`Total Bookings: ${totalBookings}, Total Workshops: ${totalWorkshops}`);
        // Slots filled calculation
        const capacityAggregation = await prisma.timeSlot.aggregate({
            _sum: { availableSpots: true },
        });
        const workshopCapacityAggregation = await prisma.workshop.aggregate({
            _sum: { maxCapacity: true },
        });

        const totalInitialSpots = workshopCapacityAggregation._sum.maxCapacity || 0;
        const totalAvailableSpots = capacityAggregation._sum.availableSpots || 0;
        const slotsFilled = totalInitialSpots - totalAvailableSpots;
        const slotsFilledPercentage = totalInitialSpots > 0 ? (slotsFilled / totalInitialSpots) * 100 : 0;

        // Popular workshops
        const popularWorkshops = await prisma.booking.groupBy({
            by: ['workshopId'],
            _count: {
                workshopId: true,
            },
            orderBy: {
                _count: {
                    workshopId: 'desc',
                },
            },
            take: 5,
        });

        // Get workshop titles for the popular workshop IDs
        const workshopIds = popularWorkshops.map(w => w.workshopId);
        const workshops = await prisma.workshop.findMany({
            where: { id: { in: workshopIds } },
            select: { id: true, title: true }
        });
        const workshopTitleMap = workshops.reduce((acc, workshop) => {
            acc[workshop.id] = workshop.title;
            return acc;
        }, {});
        
        const popularWorkshopsWithTitles = popularWorkshops.map(p => ({
            title: workshopTitleMap[p.workshopId],
            bookings: p._count.workshopId
        }));


        res.status(200).json({
            totalBookings,
            totalWorkshops,
            slotsFilled,
            slotsFilledPercentage: parseFloat(slotsFilledPercentage.toFixed(2)),
            popularWorkshops: popularWorkshopsWithTitles,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// backend/src/controllers/bookingController.js
// ... (imports and existing functions)

// @desc    Get bookings for the logged-in user
// @route   GET /api/bookings/my-bookings
// @access  Private/Customer
exports.getMyBookings = async (req, res) => {
    try {
        const userId = req.user.userId;

        const bookings = await prisma.booking.findMany({
            where: {
                userId: userId,
                deletedAt: null // Assuming you might soft delete bookings too
            },
            include: {
                workshop: { select: { title: true, date: true } },
                timeSlot: { select: { startTime: true, endTime: true } },
            },
            orderBy: {
                createdAt: 'desc',
            }
        });
        res.status(200).json(bookings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error while fetching your bookings.' });
    }
};

// @desc    Cancel a booking (by the user who owns it)
// @route   PUT /api/bookings/my-bookings/:id/cancel
// @access  Private/Customer
exports.cancelMyBooking = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        // Use a transaction to ensure we only cancel if we can increment spots
        const updatedBooking = await prisma.$transaction(async (tx) => {
            const bookingToCancel = await tx.booking.findUnique({
                where: { id },
            });

            // Security check: ensure the booking exists and belongs to the user
            if (!bookingToCancel || bookingToCancel.userId !== userId) {
                throw new Error('Booking not found or you are not authorized to cancel it.');
            }

            // Business logic: perhaps you can only cancel PENDING or CONFIRMED bookings
            if (bookingToCancel.status === 'CANCELED') {
                 throw new Error('This booking has already been canceled.');
            }

            // Increment the available spots for the associated time slot
            await tx.timeSlot.update({
                where: { id: bookingToCancel.timeSlotId },
                data: { availableSpots: { increment: 1 } },
            });

            // Update the booking status to CANCELED
            const canceledBooking = await tx.booking.update({
                where: { id },
                data: { status: 'CANCELED' },
            });
            
            return canceledBooking;
        });


        res.status(200).json({ message: 'Booking canceled successfully', booking: updatedBooking });
    } catch (error) {
        if(error.message.includes('Booking not found') || error.message.includes('already been canceled')) {
            return res.status(404).json({ message: error.message });
        }
        console.error(error);
        res.status(500).json({ message: 'Server error while canceling booking.' });
    }
};
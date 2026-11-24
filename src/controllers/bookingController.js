// src/controllers/bookingController.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// @desc Get all bookings (Admin only) with filtering and pagination
// @route GET /api/bookings
exports.getAllBookings = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page || '1', 10);
    const limit = Number.parseInt(req.query.limit || '10', 10);
    const requestedStatus = req.query.status?.toUpperCase();

    if (!Number.isInteger(page) || page < 1 ||
        !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ message: 'Page must be positive and limit must be between 1 and 100.' });
    }

    if (requestedStatus && !['PENDING', 'CONFIRMED', 'CANCELED'].includes(requestedStatus)) {
      return res.status(400).json({ message: 'Invalid booking status filter.' });
    }

    const where = {
      deletedAt: null,
      status: requestedStatus || { in: ['PENDING', 'CONFIRMED'] },
    };

    const [bookings, totalBookings] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true, email: true } },
          workshop: { select: { title: true } },
          timeSlot: { select: { startTime: true, endTime: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.booking.count({ where }),
    ]);

    return res.status(200).json({
      data: bookings,
      pagination: {
        total: totalBookings,
        page,
        limit,
        totalPages: Math.ceil(totalBookings / limit),
      },
    });
  } catch (error) {
    console.error('Get bookings failed:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get dashboard statistics (Admin only)
// @route GET /api/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const activeBookingWhere = {
      deletedAt: null,
      status: { in: ['PENDING', 'CONFIRMED'] },
    };

    const [totalBookings, totalWorkshops, timeSlots, popularWorkshops] =
      await Promise.all([
        prisma.booking.count({ where: activeBookingWhere }),
        prisma.workshop.count({ where: { deletedAt: null, date: { gte: new Date() } } }),
        prisma.timeSlot.findMany({
          select: {
            availableSpots: true,
            workshop: { select: { maxCapacity: true } },
          },
        }),
        prisma.booking.groupBy({
          by: ['workshopId'],
          where: activeBookingWhere,
          _count: { workshopId: true },
          orderBy: { _count: { workshopId: 'desc' } },
          take: 5,
        }),
      ]);

    const totalInitialSpots = timeSlots.reduce((total, slot) => total + slot.workshop.maxCapacity, 0);
    const totalAvailableSpots = timeSlots.reduce((total, slot) => total + slot.availableSpots, 0);
    const slotsFilled = Math.max(0, totalInitialSpots - totalAvailableSpots);
    const slotsFilledPercentage = totalInitialSpots > 0
      ? (slotsFilled / totalInitialSpots) * 100
      : 0;

    const workshopIds = popularWorkshops.map((item) => item.workshopId);
    const workshops = await prisma.workshop.findMany({
      where: { id: { in: workshopIds } },
      select: { id: true, title: true },
    });
    const titleById = new Map(workshops.map((workshop) => [workshop.id, workshop.title]));

    return res.status(200).json({
      totalBookings,
      totalWorkshops,
      slotsFilled,
      slotsFilledPercentage: Number(slotsFilledPercentage.toFixed(2)),
      popularWorkshops: popularWorkshops.map((item) => ({
        title: titleById.get(item.workshopId),
        bookings: item._count.workshopId,
      })),
    });
  } catch (error) {
    console.error('Get dashboard stats failed:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get bookings for the logged-in user
// @route GET /api/bookings/my-bookings
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        userId: req.user.userId,
        deletedAt: null,
      },
      include: {
        workshop: { select: { title: true, date: true } },
        timeSlot: { select: { startTime: true, endTime: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(bookings);
  } catch (error) {
    console.error('Get customer bookings failed:', error);
    return res.status(500).json({ message: 'Server error while fetching your bookings.' });
  }
};

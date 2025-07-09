// src/controllers/workshopController.js
const { PrismaClient } = require('@prisma/client');
const { createWorkshopSchema } = require('../validation/workshopValidation');
const prisma = new PrismaClient();

// @desc    Create a new workshop (Admin only)
// @route   POST /api/workshops
// @access  Private/Admin
exports.createWorkshop = async (req, res) => {
  try {
    const workshopData = createWorkshopSchema.parse(req.body);

    // Prisma Transaction: Ensure both workshop and its time slots are created, or neither are.
    const workshop = await prisma.$transaction(async (tx) => {
      const newWorkshop = await tx.workshop.create({
        data: {
          title: workshopData.title,
          description: workshopData.description,
          date: new Date(workshopData.date),
          maxCapacity: workshopData.maxCapacity,
        },
      });

      const timeSlotsData = workshopData.timeSlots.map(slot => ({
        ...slot,
        availableSpots: newWorkshop.maxCapacity, // Initial available spots = max capacity
        workshopId: newWorkshop.id,
      }));

      await tx.timeSlot.createMany({
        data: timeSlotsData,
      });

      const result = await tx.workshop.findUnique({
          where: { id: newWorkshop.id },
          include: { timeSlots: true }
      });

      return result;
    });

    res.status(201).json(workshop);
  } catch (error) {
    if (error instanceof require('zod').ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all workshops for public view (active only)
// @route   GET /api/workshops
// @access  Public
exports.getPublicWorkshops = async (req, res) => {
  try {
    const workshops = await prisma.workshop.findMany({
      where: {
        deletedAt: null, // IMPORTANT: Filter out soft-deleted workshops
        date: { gte: new Date() }, // Only show future workshops
      },
      include: {
        timeSlots: {
          where: {
            availableSpots: { gt: 0 } // Only show time slots with available spots
          },
          orderBy: {
            startTime: 'asc'
          }
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
    res.status(200).json(workshops);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


// @desc    Get ALL workshops for admin panel (including past and soft-deleted)
// @route   GET /api/workshops/admin
// @access  Private/Admin
exports.getAdminWorkshops = async (req, res) => {
    try {
      const workshops = await prisma.workshop.findMany({
        include: {
          timeSlots: true,
          _count: {
              select: { bookings: true } 
          }
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      res.status(200).json(workshops);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
};


// @desc    Soft delete a workshop (Admin only)
// @route   DELETE /api/workshops/:id
// @access  Private/Admin
exports.softDeleteWorkshop = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if workshop exists first
    const workshop = await prisma.workshop.findUnique({ where: { id } });
    if (!workshop) {
      return res.status(404).json({ message: 'Workshop not found' });
    }

    await prisma.workshop.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    res.status(200).json({ message: 'Workshop successfully soft-deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// NOTE: We will add an 'update' controller later if we have time.
// Create, Read, and Delete are the priority.

// backend/src/controllers/workshopController.js
// ... (imports and existing functions)

// @desc    Get a single workshop by ID with all details
// @route   GET /api/workshops/:id
// @access  Private/Admin
exports.getWorkshopById = async (req, res) => {
    try {
        const { id } = req.params;
        const workshop = await prisma.workshop.findUnique({
            where: { id },
            include: {
                timeSlots: true, // Include the time slots for this workshop
                bookings: {      // Include the bookings
                    where: { deletedAt: null, status: {not: "CANCELED"} }, // Only include non-deleted bookings

                    include: {
                        user: { select: { name: true, email: true } } // And the user info for each booking
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        console.log("the workshop needed",workshop)
        if (!workshop) {
            return res.status(404).json({ message: 'Workshop not found' });
        }
        res.status(200).json(workshop);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Restore a soft-deleted workshop
// @route   PUT /api/workshops/:id/restore
// @access  Private/Admin
exports.restoreWorkshop = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.workshop.update({
            where: { id },
            data: { deletedAt: null }, // Set deletedAt back to null
        });
        res.status(200).json({ message: 'Workshop successfully restored' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
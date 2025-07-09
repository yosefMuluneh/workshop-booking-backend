// src/controllers/timeSlotController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// @desc    Add a time slot to a workshop
// @route   POST /api/timeslots/:workshopId
// @access  Private/Admin
exports.addTimeSlot = async (req, res) => {
  const { workshopId } = req.params;
  const { startTime, endTime } = req.body;

  // Basic validation
  if (!startTime || !endTime) {
    return res.status(400).json({ message: 'Start time and end time are required.' });
  }

  try {
    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) {
      return res.status(404).json({ message: 'Workshop not found' });
    }

    const newTimeSlot = await prisma.timeSlot.create({
      data: {
        startTime,
        endTime,
        availableSpots: workshop.maxCapacity, // Default spots to workshop capacity
        workshopId,
      },
    });
    res.status(201).json(newTimeSlot);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// @desc    Update a time slot
// @route   PUT /api/timeslots/:id
// @access  Private/Admin
exports.updateTimeSlot = async (req, res) => {
  const { id } = req.params;
  const { startTime, endTime, availableSpots } = req.body;

  try {
    const updatedTimeSlot = await prisma.timeSlot.update({
      where: { id },
      data: {
        startTime,
        endTime,
        availableSpots: parseInt(availableSpots, 10),
      },
    });
    res.status(200).json(updatedTimeSlot);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// @desc    Delete a time slot
// @route   DELETE /api/timeslots/:id
// @access  Private/Admin
exports.deleteTimeSlot = async (req, res) => {
    const { id } = req.params;
    try {
        // Check if there are any bookings associated with this time slot
        const statusClause = ["PENDING","CONFIRMED"]
        const bookingCount = await prisma.booking.count({
            where: { timeSlotId: id, status: { in: statusClause } }
        });

        if (bookingCount > 0) {
            return res.status(400).json({ message: 'Cannot delete time slot with active bookings. Please cancel bookings first.' });
        }

        await prisma.timeSlot.delete({ where: { id } });
        res.status(200).json({ message: 'Time slot deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
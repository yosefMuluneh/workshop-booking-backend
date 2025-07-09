const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // 1. ==================== CLEAR DATABASE ====================
  console.log('--- Start clearing database ---');
  // Delete in reverse order of dependency to avoid foreign key constraint errors
  await prisma.booking.deleteMany({});
  console.log('✅ All bookings deleted.');
  await prisma.timeSlot.deleteMany({});
  console.log('✅ All time slots deleted.');
  await prisma.workshop.deleteMany({});
  console.log('✅ All workshops deleted.');
  await prisma.user.deleteMany({});
  console.log('✅ All users deleted.');
  console.log('--- Database cleared successfully ---\n');

  // 2. ==================== SEED NEW DATA ====================
  console.log('--- Start seeding new data ---');

  // --- Create Users ---
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash('password123', salt);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log(`👤 Created admin user: ${adminUser.email}`);

  const customerUser = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      name: 'Customer User',
      password: hashedPassword,
      role: 'CUSTOMER',
    },
  });
  console.log(`👤 Created customer user: ${customerUser.email}`);

  // --- Create Workshops & Time Slots ---

  // Workshop 1: Future, active, with multiple time slots (using a transaction for best practice)
  const workshop1 = await prisma.$transaction(async (tx) => {
    const newWorkshop = await tx.workshop.create({
      data: {
        title: 'Advanced React Patterns',
        description: 'A deep dive into hooks, state management, and performance optimization in React.',
        date: new Date(new Date().setDate(new Date().getDate() + 30)), // 30 days from now
        maxCapacity: 25,
      },
    });

    await tx.timeSlot.createMany({
      data: [
        { startTime: '10:00 AM', endTime: '12:00 PM', availableSpots: 25, workshopId: newWorkshop.id },
        { startTime: '02:00 PM', endTime: '04:00 PM', availableSpots: 25, workshopId: newWorkshop.id },
      ],
    });
    return newWorkshop;
  });
  console.log(`🛠️ Created workshop: "${workshop1.title}"`);


  // Workshop 2: Another future, active workshop
  const workshop2 = await prisma.workshop.create({
    data: {
      title: 'Introduction to Docker & Containers',
      description: 'Learn the fundamentals of Docker for packaging and deploying applications.',
      date: new Date(new Date().setDate(new Date().getDate() + 45)), // 45 days from now
      maxCapacity: 20,
      timeSlots: {
        create: {
          startTime: '09:00 AM',
          endTime: '01:00 PM',
          availableSpots: 20,
        },
      },
    },
  });
  console.log(`🛠️ Created workshop: "${workshop2.title}"`);


  // Workshop 3: A past workshop (for testing filters)
  const workshop3 = await prisma.workshop.create({
    data: {
      title: 'Old Tailwind CSS Workshop',
      description: 'A workshop that has already occurred.',
      date: new Date(new Date().setDate(new Date().getDate() - 10)), // 10 days ago
      maxCapacity: 15,
      timeSlots: {
        create: {
          startTime: '10:00 AM', endTime: '12:00 PM', availableSpots: 15,
        },
      },
    },
  });
  console.log(`🛠️ Created past workshop: "${workshop3.title}"`);


  // Workshop 4: An archived (soft-deleted) workshop
  const workshop4 = await prisma.workshop.create({
    data: {
      title: 'Archived CI/CD Pipelines Workshop',
      description: 'This workshop is archived and should not be visible to the public.',
      date: new Date(new Date().setDate(new Date().getDate() + 60)), // 60 days from now
      maxCapacity: 30,
      deletedAt: new Date(), // Soft-deleted
      timeSlots: {
        create: {
          startTime: '10:00 AM', endTime: '01:00 PM', availableSpots: 30,
        },
      },
    },
  });
  console.log(`🛠️ Created archived workshop: "${workshop4.title}"`);

  // --- Create Bookings ---
  // Get the first time slot of the first workshop to create a booking
  const timeSlotForBooking = await prisma.timeSlot.findFirst({
    where: { workshopId: workshop1.id },
  });

  if (timeSlotForBooking) {
    // Booking 1: Confirmed
    await prisma.booking.create({
      data: {
        status: 'CONFIRMED',
        userId: customerUser.id,
        workshopId: workshop1.id,
        timeSlotId: timeSlotForBooking.id,
      },
    });
    // Decrement the available spots for the booked slot
    await prisma.timeSlot.update({
        where: { id: timeSlotForBooking.id },
        data: { availableSpots: { decrement: 1 } }
    });
    console.log(`🎟️ Created a confirmed booking for ${customerUser.name} in "${workshop1.title}"`);

    // Booking 2: Pending
    const secondCustomer = await prisma.user.create({
        data: { email: 'customer2@example.com', name: 'Jane Doe', password: hashedPassword }
    });
    await prisma.booking.create({
        data: {
          status: 'PENDING',
          userId: secondCustomer.id,
          workshopId: workshop1.id,
          timeSlotId: timeSlotForBooking.id,
        },
    });
    await prisma.timeSlot.update({
        where: { id: timeSlotForBooking.id },
        data: { availableSpots: { decrement: 1 } }
    });
    console.log(`🎟️ Created a pending booking for ${secondCustomer.name} in "${workshop1.title}"`);
  }

  console.log('\n--- Seeding finished successfully! ---');
}

main()
  .catch((e) => {
    console.error('An error occurred while seeding the database:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Close the database connection
    await prisma.$disconnect();
  });
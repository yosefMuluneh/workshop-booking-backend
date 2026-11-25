const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function getOrCreateWorkshop(data) {
  const existing = await prisma.workshop.findFirst({ where: { title: data.title } });
  if (existing) return existing;
  return prisma.workshop.create({ data });
}

async function ensureTimeSlot(workshopId, slot) {
  const existing = await prisma.timeSlot.findFirst({
    where: { workshopId, startTime: slot.startTime, endTime: slot.endTime },
  });
  if (existing) return existing;
  return prisma.timeSlot.create({ data: { ...slot, workshopId } });
}

async function ensureBooking(data) {
  const existing = await prisma.booking.findFirst({ where: data });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({ data });
    await tx.timeSlot.update({
      where: { id: data.timeSlotId },
      data: { availableSpots: { decrement: 1 } },
    });
    return booking;
  });
}

async function main() {
  const seedPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!seedPassword) {
    throw new Error('Set SEED_DEFAULT_PASSWORD before running the seed. No database changes were made.');
  }

  console.log('Starting safe, repeatable seed (existing records will be preserved).');
  const hashedPassword = await bcrypt.hash(seedPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { name: 'Admin User', password: hashedPassword, role: 'ADMIN' },
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log(`Admin account ready: ${admin.email}`);

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      name: 'Customer User',
      password: hashedPassword,
      role: 'CUSTOMER',
    },
  });

  const secondCustomer = await prisma.user.upsert({
    where: { email: 'customer2@example.com' },
    update: {},
    create: {
      email: 'customer2@example.com',
      name: 'Jane Doe',
      password: hashedPassword,
      role: 'CUSTOMER',
    },
  });

  const now = new Date();
  const workshop1 = await getOrCreateWorkshop({
    title: 'Advanced React Patterns',
    description: 'A deep dive into hooks, state management, and performance optimization in React.',
    date: new Date(now.getTime() + 30 * 86400000),
    maxCapacity: 25,
  });
  const morningSlot = await ensureTimeSlot(workshop1.id, {
    startTime: '10:00 AM', endTime: '12:00 PM', availableSpots: 25,
  });
  await ensureTimeSlot(workshop1.id, {
    startTime: '02:00 PM', endTime: '04:00 PM', availableSpots: 25,
  });

  const workshop2 = await getOrCreateWorkshop({
    title: 'Introduction to Docker & Containers',
    description: 'Learn the fundamentals of Docker for packaging and deploying applications.',
    date: new Date(now.getTime() + 45 * 86400000),
    maxCapacity: 20,
  });
  await ensureTimeSlot(workshop2.id, {
    startTime: '09:00 AM', endTime: '01:00 PM', availableSpots: 20,
  });

  const workshop3 = await getOrCreateWorkshop({
    title: 'Old Tailwind CSS Workshop',
    description: 'A workshop that has already occurred.',
    date: new Date(now.getTime() - 10 * 86400000),
    maxCapacity: 15,
  });
  await ensureTimeSlot(workshop3.id, {
    startTime: '10:00 AM', endTime: '12:00 PM', availableSpots: 15,
  });

  const workshop4 = await getOrCreateWorkshop({
    title: 'Archived CI/CD Pipelines Workshop',
    description: 'This workshop is archived and should not be visible to the public.',
    date: new Date(now.getTime() + 60 * 86400000),
    maxCapacity: 30,
    deletedAt: now,
  });
  await ensureTimeSlot(workshop4.id, {
    startTime: '10:00 AM', endTime: '01:00 PM', availableSpots: 30,
  });

  await ensureBooking({
    status: 'CONFIRMED',
    userId: customer.id,
    workshopId: workshop1.id,
    timeSlotId: morningSlot.id,
  });
  await ensureBooking({
    status: 'PENDING',
    userId: secondCustomer.id,
    workshopId: workshop1.id,
    timeSlotId: morningSlot.id,
  });

  console.log('Safe seed completed. Existing records were not deleted.');
  console.log('Admin email: admin@example.com');
  console.log('Use the SEED_DEFAULT_PASSWORD value as the admin password.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

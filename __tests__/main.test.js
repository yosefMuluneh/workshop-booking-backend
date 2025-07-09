const request = require('supertest');
const app = require('../index'); // Your main express app file
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Main API Endpoints', () => {
  let adminToken, customerToken, testWorkshopId, testTimeSlotId;

  // --- Setup: Create users and get tokens before all tests ---
  beforeAll(async () => {
    // Clean up previous test data
    await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
    await prisma.workshop.deleteMany({ where: { title: { contains: 'Test Workshop' } } });

    // 1. Create an Admin User and get a token
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin Test', email: 'admin@test.com', password: 'password123' });
    
    // Manually set role to ADMIN (in a real app this would be a separate process)
    await prisma.user.update({ where: { email: 'admin@test.com' }, data: { role: 'ADMIN' } });
    
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    adminToken = adminLogin.body.token;

    // 2. Create a Customer User and get a token
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Customer Test', email: 'customer@test.com', password: 'password123' });
    const customerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@test.com', password: 'password123' });
    customerToken = customerLogin.body.token;
  });

  // --- Teardown: Clean up database after all tests ---
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
    await prisma.workshop.deleteMany({ where: { title: { contains: 'Test Workshop' } } });
    await prisma.$disconnect();
  });


  // --- TEST SUITE 1: Workshop Creation (Admin) ---
  describe('POST /api/workshops', () => {
    it('should allow an admin to create a new workshop', async () => {
      const res = await request(app)
        .post('/api/workshops')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: "Test Workshop for E2E",
          description: "This is a test description.",
          date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(), // 1 week from now
          maxCapacity: 10,
          timeSlots: [{ startTime: "10:00 AM", endTime: "11:00 AM" }]
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe("Test Workshop for E2E");
      
      // Save IDs for later tests
      testWorkshopId = res.body.id;
      testTimeSlotId = res.body.timeSlots[0].id;
    });

    it('should prevent a non-admin from creating a workshop', async () => {
      const res = await request(app)
        .post('/api/workshops')
        .set('Authorization', `Bearer ${customerToken}`) // Use customer token
        .send({ title: "Failed Test Workshop", description: "This should not be created.", date: new Date().toISOString(), maxCapacity: 5, timeSlots: [] });

      expect(res.statusCode).toEqual(403); // 403 Forbidden
    });
  });

  // --- TEST SUITE 2: Public Workshop Listing ---
  describe('GET /api/workshops', () => {
    it('should return a list of active, future workshops to the public', async () => {
      const res = await request(app).get('/api/workshops');

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Find the workshop we just created
      const foundWorkshop = res.body.find(w => w.id === testWorkshopId);
      expect(foundWorkshop).toBeDefined();
      expect(foundWorkshop.title).toBe("Test Workshop for E2E");
    });
  });

  // --- TEST SUITE 3: Booking Creation (Customer) ---
  describe('POST /api/bookings', () => {
    it('should allow a logged-in customer to book a workshop', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          workshopId: testWorkshopId,
          timeSlotId: testTimeSlotId,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('bookingId');
    });

    it('should prevent a customer from booking the same slot twice', async () => {
      // This test depends on the previous one having run
       const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          workshopId: testWorkshopId,
          timeSlotId: testTimeSlotId,
        });
      
      expect(res.statusCode).toEqual(409); // 409 Conflict
      expect(res.body.message).toBe('You have already booked this time slot.');
    });
  });
});
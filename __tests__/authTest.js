// __tests__/auth.test.js

const request = require('supertest');
const app = require('../index'); // Import your express app
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Auth Endpoints', () => {
  const testUser = {
    name: 'Test User',
    email: 'testuser@example.com',
    password: 'password123',
  };

  // Clean up the database after all tests in this file have run
  afterAll(async () => {
    // Delete the test user if it exists
    await prisma.user.deleteMany({
      where: {
        email: testUser.email,
      },
    });
    await prisma.$disconnect(); // Disconnect Prisma Client
  });

  // Test suite for POST /api/auth/register
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'User created successfully');
      expect(res.body).toHaveProperty('userId');
    });

    it('should fail to register a user with an existing email', async () => {
      // This test depends on the previous test having run successfully
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'User already exists');
    });

    it('should fail registration with invalid data (e.g., no email)', async () => {
      const { email, ...invalidUser } = testUser; // User object without email
      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidUser);
        
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'Validation failed');
    });
  });

  // Test suite for POST /api/auth/login
  describe('POST /api/auth/login', () => {
    it('should log in a registered user and return a token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('role', 'CUSTOMER');
    });

    it('should fail to log in with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should fail to log in a non-existent user', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nouser@example.com',
            password: 'password123',
          });
  
        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('message', 'Invalid credentials');
    });
  });
});
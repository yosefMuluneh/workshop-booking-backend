// src/validation/authValidation.js
const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(2, { error: 'Name must be at least 2 characters long' }),
  email: z.email({ error: 'Invalid email address' }),
  password: z.string().min(6, { error: 'Password must be at least 6 characters long' }),
});

const loginSchema = z.object({
  email: z.email({ error: 'Invalid email address' }),
  password: z.string().min(1, { error: 'Password is required' }),
});

module.exports = {
  registerSchema,
  loginSchema,
};
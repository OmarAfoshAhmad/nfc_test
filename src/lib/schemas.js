import { z } from 'zod';

export const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
});

export const customerSchema = z.object({
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().min(8, 'Phone number must be valid').optional().or(z.literal('')),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    uid: z.string().optional().or(z.literal('')),
    type: z.enum(['single', 'family']).optional().default('single'),
});

import { z } from 'zod';
export const registerSchema=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(8),role:z.enum(['STUDENT','INSTRUCTOR']).default('STUDENT')});
export const loginSchema=z.object({email:z.string().email(),password:z.string().min(8),totpToken:z.string().optional()});
export const courseSchema=z.object({title:z.string().min(3),slug:z.string().min(3),shortDescription:z.string().min(10),fullDescription:z.string().min(20),price:z.number().nonnegative(),salePrice:z.number().nonnegative().optional(),categoryId:z.string(),language:z.string().default('en'),level:z.string().default('beginner'),requirements:z.array(z.string()).default([]),outcomes:z.array(z.string()).default([])});

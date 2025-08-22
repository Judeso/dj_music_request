import { neon } from '@netlify/neon';

export const sql = neon(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL); 
// Database connection with fallback environment variable

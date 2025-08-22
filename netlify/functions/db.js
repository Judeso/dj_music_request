import { neon } from '@netlify/neon';

const dbUrl = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

if (!dbUrl) {
  console.error('❌ DATABASE_URL manquante! Variables disponibles:', Object.keys(process.env).filter(k => k.includes('DATA')));
  throw new Error('DATABASE_URL ou NETLIFY_DATABASE_URL requis');
}

console.log('✅ DB URL configurée:', dbUrl.substring(0, 20) + '...');
export const sql = neon(dbUrl);

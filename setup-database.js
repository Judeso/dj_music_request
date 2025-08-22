// Script Node.js pour créer le schéma de base de données Neon
import { neon } from '@netlify/neon';
import crypto from 'crypto';

const dbUrl = process.env.NETLIFY_DATABASE_URL || 'postgresql://neondb_owner:npg_s3fOQ2PkYqor@ep-cool-credit-aesngcgk-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

console.log('🔗 Connexion à Neon...');
const sql = neon(dbUrl);

async function setupDatabase() {
  try {
    console.log('📋 Vérification/mise à jour de la table events...');
    
    // Ajouter les colonnes manquantes si elles n'existent pas
    try {
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at TEXT`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TEXT`;
      console.log('✅ Colonnes created_at/updated_at ajoutées');
    } catch (e) {
      console.log('ℹ️ Colonnes déjà présentes ou table inexistante, création complète...');
      await sql`
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          date TEXT NOT NULL,
          status TEXT DEFAULT 'preparation',
          location TEXT,
          expected_guests INTEGER,
          description TEXT,
          short_code TEXT,
          created_at TEXT,
          updated_at TEXT
        )
      `;
    }

    console.log('📋 Création de la table requests...');
    await sql`
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        artist TEXT NOT NULL,
        song TEXT NOT NULL,
        requester_name TEXT,
        status TEXT DEFAULT 'pending',
        played_at TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `;

    console.log('🔍 Création des index...');
    await sql`CREATE INDEX IF NOT EXISTS idx_requests_event_id ON requests(event_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)`;

    console.log('✅ Vérification des tables créées...');
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('events', 'requests')
    `;
    
    console.log('📊 Tables trouvées:', tables.map(t => t.table_name));

    // Test d'insertion pour vérifier que tout fonctionne
    console.log('🧪 Test d\'insertion...');
    const testId = crypto.randomUUID();
    await sql`
      INSERT INTO events (id, name, date, status, created_at, updated_at)
      VALUES (${testId}, 'Test Event', '2025-08-23T12:00', 'preparation', ${new Date().toISOString()}, ${new Date().toISOString()})
    `;

    const inserted = await sql`SELECT * FROM events WHERE id = ${testId}`;
    console.log('✅ Test réussi, événement créé:', inserted[0]);

    // Nettoyage du test
    await sql`DELETE FROM events WHERE id = ${testId}`;
    console.log('🧹 Test nettoyé');

    console.log('🎉 Base de données configurée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error);
    process.exit(1);
  }
}

setupDatabase();

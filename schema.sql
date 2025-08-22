-- Schema pour la base de données DJ Music Request
-- À exécuter dans Neon pour créer les tables manquantes

-- Table des événements
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
);

-- Table des demandes musicales
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  artist TEXT NOT NULL,
  song TEXT NOT NULL,
  requester_name TEXT,
  status TEXT DEFAULT 'pending',
  played_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_requests_event_id ON requests(event_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

-- Vérifier que les tables existent
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('events', 'requests');

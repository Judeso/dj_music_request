// netlify/functions/events.js - Version corrigée
import { getStore } from '@netlify/blobs';

// Configuration simplifiée - laisse Netlify auto-détecter
const dataStore = getStore('dj-events');

// Lire les données avec gestion d'erreur améliorée
async function readData() {
  try {
    const data = await dataStore.get('app-data', { type: 'json' });
    return data || {
      events: [],
      requests: [],
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Blobs read error:', error);
    // Retourner des données par défaut si Blobs pas encore configuré
    return {
      events: [],
      requests: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

// Reste du code identique...

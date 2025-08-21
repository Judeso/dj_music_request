// netlify/functions/events.js
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

// Chemin vers le fichier de données (persistent sur Netlify)
const DATA_PATH = '/tmp/dj_events.json';

// Initialiser le fichier de données s'il n'existe pas
function initDataFile() {
  if (!existsSync(DATA_PATH)) {
    const initialData = {
      events: [],
      requests: [],
      lastUpdated: new Date().toISOString()
    };
    writeFileSync(DATA_PATH, JSON.stringify(initialData, null, 2));
  }
}

// Lire les données
function readData() {
  initDataFile();
  try {
    const data = readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    return { events: [], requests: [], lastUpdated: new Date().toISOString() };
  }
}

// Écrire les données
function writeData(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data:', error);
    return false;
  }
}

// Générer un ID unique
function generateId() {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Valider les données d'événement
function validateEvent(event) {
  const required = ['name', 'type', 'date', 'location', 'expectedGuests', 'status'];
  
  for (const field of required) {
    if (!event[field]) {
      return { valid: false, error: `Le champ ${field} est requis` };
    }
  }
  
  if (typeof event.expectedGuests !== 'number' || event.expectedGuests < 1) {
    return { valid: false, error: 'Le nombre d\'invités doit être un nombre positif' };
  }
  
  const validStatuses = ['preparation', 'active', 'finished', 'cancelled'];
  if (!validStatuses.includes(event.status)) {
    return { valid: false, error: 'Statut invalide' };
  }
  
  return { valid: true };
}

// Nettoyer les données d'entrée
function sanitizeEvent(event) {
  return {
    id: event.id || generateId(),
    name: String(event.name).trim().slice(0, 100),
    type: String(event.type).trim(),
    date: new Date(event.date).toISOString(),
    location: String(event.location).trim().slice(0, 200),
    expectedGuests: parseInt(event.expectedGuests),
    description: event.description ? String(event.description).trim().slice(0, 500) : '',
    status: String(event.status).trim(),
    createdAt: event.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Gérer les requêtes OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const data = readData();
    const method = event.httpMethod;
    const path = event.path;
    
    // Extraire l'ID de l'événement depuis le path si présent
    const pathParts = path.split('/');
    const eventId = pathParts[pathParts.length - 1];
    const isSpecificEvent = eventId && eventId !== 'events';

    switch (method) {
      case 'GET':
        if (isSpecificEvent) {
          // Récupérer un événement spécifique
          const specificEvent = data.events.find(e => e.id === eventId);
          if (!specificEvent) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ success: false, error: 'Événement non trouvé' })
            };
          }
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: specificEvent })
          };
        } else {
          // Récupérer tous les événements
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true, 
              data: data.events,
              count: data.events.length 
            })
          };
        }

      case 'POST':
        // Créer un nouvel événement
        if (!event.body) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Corps de la requête manquant' })
          };
        }

        const newEventData = JSON.parse(event.body);
        const validation = validateEvent(newEventData);
        
        if (!validation.valid) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: validation.error })
          };
        }

        const newEvent = sanitizeEvent(newEventData);
        data.events.push(newEvent);
        
        if (writeData(data)) {
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ success: true, data: newEvent })
          };
        } else {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Erreur lors de la sauvegarde' })
          };
        }

      case 'PUT':
        // Mettre à jour un événement existant
        if (!isSpecificEvent) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'ID d\'événement requis' })
          };
        }

        if (!event.body) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Corps de la requête manquant' })
          };
        }

        const updateData = JSON.parse(event.body);
        const eventIndex = data.events.findIndex(e => e.id === eventId);
        
        if (eventIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'Événement non trouvé' })
          };
        }

        // Fusionner les données existantes avec les nouvelles
        const existingEvent = data.events[eventIndex];
        const updatedEventData = { ...existingEvent, ...updateData };
        
        const updateValidation = validateEvent(updatedEventData);
        if (!updateValidation.valid) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: updateValidation.error })
          };
        }

        const updatedEvent = sanitizeEvent(updatedEventData);
        data.events[eventIndex] = updatedEvent;
        
        if (writeData(data)) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: updatedEvent })
          };
        } else {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Erreur lors de la mise à jour' })
          };
        }

      case 'DELETE':
        // Supprimer un événement
        if (!isSpecificEvent) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'ID d\'événement requis' })
          };
        }

        const deleteIndex = data.events.findIndex(e => e.id === eventId);
        
        if (deleteIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'Événement non trouvé' })
          };
        }

        // Supprimer aussi toutes les demandes liées
        data.events.splice(deleteIndex, 1);
        data.requests = data.requests.filter(r => r.eventId !== eventId);
        
        if (writeData(data)) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Événement supprimé avec succès' })
          };
        } else {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Erreur lors de la suppression' })
          };
        }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ success: false, error: 'Méthode non autorisée' })
        };
    }

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false, 
        error: 'Erreur interne du serveur',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
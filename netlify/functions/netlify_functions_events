// netlify/functions/events.js - Version avec Netlify Blobs
import { getStore } from '@netlify/blobs';

// Initialiser le store Netlify Blobs
const dataStore = getStore('dj-events');

// Lire les données depuis Netlify Blobs
async function readData() {
  try {
    const data = await dataStore.get('app-data', { type: 'json' });
    return data || {
      events: [],
      requests: [],
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error reading data from Blobs:', error);
    return {
      events: [],
      requests: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

// Écrire les données vers Netlify Blobs
async function writeData(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    await dataStore.set('app-data', JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error writing data to Blobs:', error);
    return false;
  }
}

// Générer un ID unique
function generateId() {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Générer un code court
function generateShortCode(eventName, eventType) {
  const namePrefix = eventName.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, 'EV');
  const typePrefix = eventType.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, 'XX');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${namePrefix}${typePrefix}${randomSuffix}`;
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
    updatedAt: new Date().toISOString(),
    shortCode: event.shortCode || generateShortCode(event.name, event.type)
  };
}

export default async (request, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Gérer les requêtes OPTIONS (preflight)
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  try {
    const data = await readData();
    const method = request.method;
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const eventId = pathParts[pathParts.length - 1];
    const isSpecificEvent = eventId && eventId !== 'events';

    switch (method) {
      case 'GET':
        if (isSpecificEvent) {
          const specificEvent = data.events.find(e => e.id === eventId);
          if (!specificEvent) {
            return new Response(
              JSON.stringify({ success: false, error: 'Événement non trouvé' }),
              { status: 404, headers }
            );
          }
          return new Response(
            JSON.stringify({ success: true, data: specificEvent }),
            { status: 200, headers }
          );
        } else {
          return new Response(
            JSON.stringify({ 
              success: true, 
              data: data.events,
              count: data.events.length 
            }),
            { status: 200, headers }
          );
        }

      case 'POST':
        const newEventData = await request.json();
        const validation = validateEvent(newEventData);
        
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: validation.error }),
            { status: 400, headers }
          );
        }

        const newEvent = sanitizeEvent(newEventData);
        data.events.push(newEvent);
        
        if (await writeData(data)) {
          return new Response(
            JSON.stringify({ success: true, data: newEvent }),
            { status: 201, headers }
          );
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'Erreur lors de la sauvegarde' }),
            { status: 500, headers }
          );
        }

      case 'PUT':
        if (!isSpecificEvent) {
          return new Response(
            JSON.stringify({ success: false, error: 'ID d\'événement requis' }),
            { status: 400, headers }
          );
        }

        const updateData = await request.json();
        const eventIndex = data.events.findIndex(e => e.id === eventId);
        
        if (eventIndex === -1) {
          return new Response(
            JSON.stringify({ success: false, error: 'Événement non trouvé' }),
            { status: 404, headers }
          );
        }

        const existingEvent = data.events[eventIndex];
        const updatedEventData = { ...existingEvent, ...updateData };
        
        const updateValidation = validateEvent(updatedEventData);
        if (!updateValidation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: updateValidation.error }),
            { status: 400, headers }
          );
        }

        const updatedEvent = sanitizeEvent(updatedEventData);
        data.events[eventIndex] = updatedEvent;
        
        if (await writeData(data)) {
          return new Response(
            JSON.stringify({ success: true, data: updatedEvent }),
            { status: 200, headers }
          );
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'Erreur lors de la mise à jour' }),
            { status: 500, headers }
          );
        }

      case 'DELETE':
        if (!isSpecificEvent) {
          return new Response(
            JSON.stringify({ success: false, error: 'ID d\'événement requis' }),
            { status: 400, headers }
          );
        }

        const deleteIndex = data.events.findIndex(e => e.id === eventId);
        
        if (deleteIndex === -1) {
          return new Response(
            JSON.stringify({ success: false, error: 'Événement non trouvé' }),
            { status: 404, headers }
          );
        }

        data.events.splice(deleteIndex, 1);
        data.requests = data.requests.filter(r => r.eventId !== eventId);
        
        if (await writeData(data)) {
          return new Response(
            JSON.stringify({ success: true, message: 'Événement supprimé avec succès' }),
            { status: 200, headers }
          );
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'Erreur lors de la suppression' }),
            { status: 500, headers }
          );
        }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Méthode non autorisée' }),
          { status: 405, headers }
        );
    }

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erreur interne du serveur',
        details: error.message
      }),
      { 
        status: 500, 
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      }
    );
  }
};

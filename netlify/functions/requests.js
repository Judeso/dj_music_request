// netlify/functions/requests.js - Version avec Netlify Blobs
import { getStore } from '@netlify/blobs';

// Initialiser le store Netlify Blobs (même store que events.js)
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
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Valider les données de demande musicale
function validateRequest(request) {
  const required = ['eventId', 'songTitle', 'artist', 'userName', 'userId'];
  
  for (const field of required) {
    if (!request[field]) {
      return { valid: false, error: `Le champ ${field} est requis` };
    }
  }
  
  if (request.songTitle.length > 200) {
    return { valid: false, error: 'Le titre de la chanson est trop long' };
  }
  
  if (request.artist.length > 100) {
    return { valid: false, error: 'Le nom de l\'artiste est trop long' };
  }
  
  if (request.userName.length > 50) {
    return { valid: false, error: 'Le nom d\'utilisateur est trop long' };
  }
  
  const validStatuses = ['pending', 'played', 'rejected'];
  if (request.status && !validStatuses.includes(request.status)) {
    return { valid: false, error: 'Statut invalide' };
  }
  
  return { valid: true };
}

// Nettoyer les données d'entrée
function sanitizeRequest(request) {
  return {
    id: request.id || generateId(),
    eventId: String(request.eventId).trim(),
    songTitle: String(request.songTitle).trim().slice(0, 200),
    artist: String(request.artist).trim().slice(0, 100),
    userName: String(request.userName).trim().slice(0, 50),
    userId: String(request.userId).trim(),
    status: request.status || 'pending',
    timestamp: request.timestamp || new Date().toISOString(),
    playedAt: request.playedAt || null,
    userIP: request.userIP || null
  };
}

// Vérifier les limites anti-spam
function checkSpamLimits(data, request, userIP) {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
  
  const userRequestsLastHour = data.requests.filter(r => 
    r.userId === request.userId && 
    new Date(r.timestamp) > oneHourAgo
  );
  
  if (userRequestsLastHour.length >= 10) {
    return { allowed: false, error: 'Trop de demandes dans la dernière heure (maximum 10)' };
  }
  
  const ipRequestsRecent = data.requests.filter(r => 
    r.userIP === userIP && 
    new Date(r.timestamp) > thirtySecondsAgo
  );
  
  if (ipRequestsRecent.length >= 1) {
    return { allowed: false, error: 'Veuillez attendre 30 secondes entre chaque demande' };
  }
  
  const userPendingRequests = data.requests.filter(r => 
    r.userId === request.userId && 
    r.eventId === request.eventId && 
    r.status === 'pending'
  );
  
  if (userPendingRequests.length >= 5) {
    return { allowed: false, error: 'Maximum 5 demandes en attente par événement' };
  }
  
  return { allowed: true };
}

// Vérifier si l'événement existe et est actif
function validateEvent(data, eventId) {
  const event = data.events.find(e => e.id === eventId);
  
  if (!event) {
    return { valid: false, error: 'Événement non trouvé' };
  }
  
  if (event.status !== 'active') {
    return { valid: false, error: 'Cet événement n\'accepte plus de demandes musicales' };
  }
  
  return { valid: true };
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
    const queryParams = Object.fromEntries(url.searchParams);
    const userIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 'unknown';
    
    // Extraire l'ID de la demande depuis le path si présent
    const pathParts = url.pathname.split('/');
    const requestId = pathParts[pathParts.length - 1];
    const isSpecificRequest = requestId && requestId !== 'requests';

    switch (method) {
      case 'GET':
        if (isSpecificRequest) {
          const specificRequest = data.requests.find(r => r.id === requestId);
          if (!specificRequest) {
            return new Response(
              JSON.stringify({ success: false, error: 'Demande non trouvée' }),
              { status: 404, headers }
            );
          }
          return new Response(
            JSON.stringify({ success: true, data: specificRequest }),
            { status: 200, headers }
          );
        } else {
          let filteredRequests = data.requests;
          
          if (queryParams.eventId) {
            filteredRequests = filteredRequests.filter(r => r.eventId === queryParams.eventId);
          }
          
          if (queryParams.userId) {
            filteredRequests = filteredRequests.filter(r => r.userId === queryParams.userId);
          }
          
          if (queryParams.status) {
            filteredRequests = filteredRequests.filter(r => r.status === queryParams.status);
          }
          
          filteredRequests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          const limit = parseInt(queryParams.limit) || 100;
          filteredRequests = filteredRequests.slice(0, limit);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              data: filteredRequests,
              count: filteredRequests.length 
            }),
            { status: 200, headers }
          );
        }

      case 'POST':
        const newRequestData = await request.json();
        newRequestData.userIP = userIP;
        
        const validation = validateRequest(newRequestData);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: validation.error }),
            { status: 400, headers }
          );
        }
        
        const eventValidation = validateEvent(data, newRequestData.eventId);
        if (!eventValidation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: eventValidation.error }),
            { status: 400, headers }
          );
        }
        
        const spamCheck = checkSpamLimits(data, newRequestData, userIP);
        if (!spamCheck.allowed) {
          return new Response(
            JSON.stringify({ success: false, error: spamCheck.error }),
            { status: 429, headers }
          );
        }

        const newRequest = sanitizeRequest(newRequestData);
        data.requests.push(newRequest);
        
        if (await writeData(data)) {
          return new Response(
            JSON.stringify({ success: true, data: newRequest }),
            { status: 201, headers }
          );
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'Erreur lors de la sauvegarde' }),
            { status: 500, headers }
          );
        }

      case 'PUT':
        if (!isSpecificRequest) {
          return new Response(
            JSON.stringify({ success: false, error: 'ID de demande requis' }),
            { status: 400, headers }
          );
        }

        const updateData = await request.json();
        const requestIndex = data.requests.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) {
          return new Response(
            JSON.stringify({ success: false, error: 'Demande non trouvée' }),
            { status: 404, headers }
          );
        }

        const existingRequest = data.requests[requestIndex];
        const updatedRequestData = { ...existingRequest, ...updateData };
        
        if (updateData.status === 'played' && !updatedRequestData.playedAt) {
          updatedRequestData.playedAt = new Date().toISOString();
        }
        
        const updateValidation = validateRequest(updatedRequestData);
        if (!updateValidation.valid) {
          return new Response(
            JSON.stringify({ success: false, error: updateValidation.error }),
            { status: 400, headers }
          );
        }

        const updatedRequest = sanitizeRequest(updatedRequestData);
        data.requests[requestIndex] = updatedRequest;
        
        if (await writeData(data)) {
          return new Response(
            JSON.stringify({ success: true, data: updatedRequest }),
            { status: 200, headers }
          );
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'Erreur lors de la mise à jour' }),
            { status: 500, headers }
          );
        }

      case 'DELETE':
        if (!isSpecificRequest) {
          return new Response(
            JSON.stringify({ success: false, error: 'ID de demande requis' }),
            { status: 400, headers }
          );
        }

        const deleteIndex = data.requests.findIndex(r => r.id === requestId);
        
        if (deleteIndex === -1) {
          return new Response(
            JSON.stringify({ success: false, error: 'Demande non trouvée' }),
            { status: 404, headers }
          );
        }

        data.requests.splice(deleteIndex, 1);
        
        if (await writeData(data)) {
          return new Response(
            JSON.stringify({ success: true, message: 'Demande supprimée avec succès' }),
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

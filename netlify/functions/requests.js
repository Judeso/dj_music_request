// netlify/functions/requests.js
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

// Chemin vers le fichier de données
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
  
  // Vérifier les demandes par utilisateur dans la dernière heure
  const userRequestsLastHour = data.requests.filter(r => 
    r.userId === request.userId && 
    new Date(r.timestamp) > oneHourAgo
  );
  
  if (userRequestsLastHour.length >= 10) {
    return { allowed: false, error: 'Trop de demandes dans la dernière heure (maximum 10)' };
  }
  
  // Vérifier les demandes par IP dans les 30 dernières secondes
  const ipRequestsRecent = data.requests.filter(r => 
    r.userIP === userIP && 
    new Date(r.timestamp) > thirtySecondsAgo
  );
  
  if (ipRequestsRecent.length >= 1) {
    return { allowed: false, error: 'Veuillez attendre 30 secondes entre chaque demande' };
  }
  
  // Vérifier les demandes en attente pour cet événement par utilisateur
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
    const queryParams = event.queryStringParameters || {};
    const userIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    
    // Extraire l'ID de la demande depuis le path si présent
    const pathParts = event.path.split('/');
    const requestId = pathParts[pathParts.length - 1];
    const isSpecificRequest = requestId && requestId !== 'requests';

    switch (method) {
      case 'GET':
        if (isSpecificRequest) {
          // Récupérer une demande spécifique
          const specificRequest = data.requests.find(r => r.id === requestId);
          if (!specificRequest) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ success: false, error: 'Demande non trouvée' })
            };
          }
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: specificRequest })
          };
        } else {
          // Récupérer les demandes avec filtres optionnels
          let filteredRequests = data.requests;
          
          // Filtrer par événement
          if (queryParams.eventId) {
            filteredRequests = filteredRequests.filter(r => r.eventId === queryParams.eventId);
          }
          
          // Filtrer par utilisateur
          if (queryParams.userId) {
            filteredRequests = filteredRequests.filter(r => r.userId === queryParams.userId);
          }
          
          // Filtrer par statut
          if (queryParams.status) {
            filteredRequests = filteredRequests.filter(r => r.status === queryParams.status);
          }
          
          // Trier par timestamp (plus récent en premier)
          filteredRequests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          // Limiter le nombre de résultats
          const limit = parseInt(queryParams.limit) || 100;
          filteredRequests = filteredRequests.slice(0, limit);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true, 
              data: filteredRequests,
              count: filteredRequests.length 
            })
          };
        }

      case 'POST':
        // Créer une nouvelle demande musicale
        if (!event.body) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Corps de la requête manquant' })
          };
        }

        const newRequestData = JSON.parse(event.body);
        
        // Ajouter l'IP utilisateur pour l'anti-spam
        newRequestData.userIP = userIP;
        
        // Valider la demande
        const validation = validateRequest(newRequestData);
        if (!validation.valid) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: validation.error })
          };
        }
        
        // Vérifier que l'événement existe et est actif
        const eventValidation = validateEvent(data, newRequestData.eventId);
        if (!eventValidation.valid) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: eventValidation.error })
          };
        }
        
        // Vérifier les limites anti-spam
        const spamCheck = checkSpamLimits(data, newRequestData, userIP);
        if (!spamCheck.allowed) {
          return {
            statusCode: 429,
            headers,
            body: JSON.stringify({ success: false, error: spamCheck.error })
          };
        }

        const newRequest = sanitizeRequest(newRequestData);
        data.requests.push(newRequest);
        
        if (writeData(data)) {
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ success: true, data: newRequest })
          };
        } else {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Erreur lors de la sauvegarde' })
          };
        }

      case 'PUT':
        // Mettre à jour une demande existante (principalement pour le statut)
        if (!isSpecificRequest) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'ID de demande requis' })
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
        const requestIndex = data.requests.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'Demande non trouvée' })
          };
        }

        // Fusionner les données existantes avec les nouvelles
        const existingRequest = data.requests[requestIndex];
        const updatedRequestData = { ...existingRequest, ...updateData };
        
        // Si on marque comme joué, ajouter la timestamp
        if (updateData.status === 'played' && !updatedRequestData.playedAt) {
          updatedRequestData.playedAt = new Date().toISOString();
        }
        
        const updateValidation = validateRequest(updatedRequestData);
        if (!updateValidation.valid) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: updateValidation.error })
          };
        }

        const updatedRequest = sanitizeRequest(updatedRequestData);
        data.requests[requestIndex] = updatedRequest;
        
        if (writeData(data)) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: updatedRequest })
          };
        } else {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Erreur lors de la mise à jour' })
          };
        }

      case 'DELETE':
        // Supprimer une demande
        if (!isSpecificRequest) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'ID de demande requis' })
          };
        }

        const deleteIndex = data.requests.findIndex(r => r.id === requestId);
        
        if (deleteIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'Demande non trouvée' })
          };
        }

        data.requests.splice(deleteIndex, 1);
        
        if (writeData(data)) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Demande supprimée avec succès' })
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
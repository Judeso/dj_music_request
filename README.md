# DJ Music Request App

Application web permettant aux participants d'un événement d'envoyer des suggestions de musique au DJ en temps réel.

## 🚀 Fonctionnalités

- **Interface utilisateur moderne** : Design responsive avec animations fluides
- **Gestion d'événements** : Création et gestion d'événements DJ
- **Demandes de musique** : Soumission de suggestions avec titre, artiste et nom d'utilisateur
- **Panel d'administration** : Interface pour les DJs pour gérer les demandes
- **Base de données** : Stockage persistant avec PostgreSQL via Netlify
- **API REST** : Endpoints sécurisés pour toutes les opérations

## 🛠️ Technologies

- **Frontend** : HTML5, CSS3, JavaScript (Vanilla)
- **Backend** : Netlify Functions (Node.js)
- **Base de données** : PostgreSQL avec @netlify/neon
- **Déploiement** : Netlify
- **Style** : CSS moderne avec variables CSS et animations

## 📁 Structure du projet

```
dj_music_request-main/
├── public/                 # Frontend files
│   ├── admin-login.html   # Page d'authentification (gateway DJ)
│   ├── index.html         # Tableau de bord DJ (interface principale)
│   ├── participant.html   # Page publique pour soumettre des demandes (via QR code)
│   └── auth-protection.js # Protection d'authentification pour l'admin
├── netlify/
│   └── functions/         # Serverless functions
│       ├── db.js          # Configuration base de données
│       ├── events.js      # API des événements
│       └── requests.js    # API des demandes
├── package.json           # Dépendances et scripts
└── netlify.toml          # Configuration Netlify
```

## 🚀 Installation et déploiement

### Prérequis
- Node.js 20.x
- npm 10.x
- Compte Netlify
- Base de données PostgreSQL (Netlify fournit une instance gratuite)

### Déploiement sur Netlify

1. **Cloner le projet**
   ```bash
   git clone <repository-url>
   cd dj_music_request-main
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configuration de la base de données**
   - Créer une base de données PostgreSQL sur Netlify
   - Ajouter la variable d'environnement `DATABASE_URL` dans les paramètres Netlify

4. **Déployer**
   ```bash
   npm run deploy
   ```

### Développement local

```bash
# Démarrer le serveur de développement
npm run dev

# L'application sera disponible sur http://localhost:8888
```

## 🗄️ Base de données

### Table `events`
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Table `requests`
```sql
CREATE TABLE requests (
    id UUID PRIMARY KEY,
    event_id UUID REFERENCES events(id),
    song_title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    user_id UUID,
    status VARCHAR(20) DEFAULT 'pending',
    timestamp TIMESTAMP DEFAULT NOW()
);
```

## 📡 API Endpoints

### Events
- `GET /api/events` - Récupérer tous les événements
- `POST /api/events` - Créer un nouvel événement

### Requests
- `GET /api/requests` - Récupérer toutes les demandes
- `GET /api/requests?eventId=<id>` - Récupérer les demandes d'un événement
- `POST /api/requests` - Créer une nouvelle demande
- `PUT /api/requests?id=<id>` - Mettre à jour le statut d'une demande

## 🎨 Interface utilisateur

- **admin-login.html** : Porte d'entrée d'authentification pour le DJ (identifiants par défaut: admin / dj2025!)
- **index.html** : Tableau de bord d'administration du DJ (gestion des événements et demandes)
- **participant.html** : Interface publique où les invités soumettent leurs demandes (accès via QR code / lien)

## 🔒 Sécurité

- CORS configuré pour toutes les API
- Validation des données côté serveur
- Gestion d'erreurs robuste
- Variables d'environnement pour les secrets

## 📝 Licence

MIT License - voir le fichier package.json pour plus de détails.

## 👥 Contribution

1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commit vos changements
4. Push vers la branche
5. Ouvrir une Pull Request

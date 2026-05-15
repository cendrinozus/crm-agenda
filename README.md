# CRM Agenda — Documentation complète

Application de suivi client synchronisée avec Google Calendar.  
Stack : **Flask** · **React + TypeScript** · **MySQL** · **Claude AI** · **Whisper**

---

## Architecture

```
crm-agenda/
├── backend/                    # Flask API
│   ├── app/
│   │   ├── __init__.py         # App factory
│   │   ├── models.py           # SQLAlchemy models (User, Client, Meeting, MeetingNote)
│   │   ├── routes/
│   │   │   ├── auth.py         # Google OAuth2 + JWT
│   │   │   ├── calendar.py     # Sync Google Calendar
│   │   │   ├── clients.py      # CRUD clients + merge
│   │   │   ├── meetings.py     # Meetings
│   │   │   ├── notes.py        # Notes par meeting
│   │   │   ├── voice.py        # Transcription audio (Whisper/Google)
│   │   │   └── ai.py           # Claude : résumé, agenda, tâches
│   │   └── services/
│   │       └── calendar_service.py  # Sync + détection clients
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   └── run.py
│
├── frontend/                   # React + TypeScript
│   ├── src/
│   │   ├── App.tsx             # Routing
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── AuthCallbackPage.tsx
│   │   │   ├── DashboardPage.tsx   # Tableau de bord
│   │   │   ├── ClientPage.tsx      # Fiche client + timeline
│   │   │   ├── MeetingPage.tsx
│   │   │   └── SettingsPage.tsx    # Sync + fusion clients
│   │   ├── components/
│   │   │   ├── layout/AppLayout.tsx      # Sidebar + navigation
│   │   │   └── features/
│   │   │       ├── VoiceRecorder.tsx     # Enregistrement + transcription
│   │   │       └── MeetingNoteEditor.tsx # Notes + IA
│   │   ├── services/api.ts     # Axios + tous les endpoints
│   │   └── store/authStore.ts  # Zustand auth
│   ├── package.json
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── nginx.conf
│
├── docs/schema.sql             # Schéma MySQL de référence
└── docker-compose.yml
```

---

## Installation

### Prérequis
- Python 3.12+
- Node.js 20+
- MySQL 8.0
- (optionnel) Redis, Docker

---

### 1. Google Cloud Console

1. Allez sur https://console.cloud.google.com
2. Créez un projet (ex: `crm-agenda`)
3. **APIs & Services → Bibliothèque** → activez :
   - `Google Calendar API`
   - `Google+ API` (pour le profil)
4. **APIs & Services → Identifiants → Créer des identifiants → ID client OAuth 2.0**
   - Type : Application Web
   - Origines autorisées : `http://localhost:3000`
   - URI de redirection : `http://localhost:5000/auth/google/callback`
5. Notez `Client ID` et `Client Secret`

---

### 2. Backend Flask

```bash
cd backend

# Copier et remplir le .env
cp .env.example .env
# Éditez .env avec vos clés

# Environnement virtuel
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Dépendances
pip install -r requirements.txt

# Base de données MySQL
mysql -u root -p -e "CREATE DATABASE crm_agenda CHARACTER SET utf8mb4;"

# Migrations
flask --app run:app db init
flask --app run:app db migrate -m "Initial schema"
flask --app run:app db upgrade

# Lancer
python run.py
```

Le backend écoute sur http://localhost:5000

---

### 3. Frontend React

```bash
cd frontend

npm install
npm run dev
```

Le frontend écoute sur http://localhost:3000

---

### 4. Variables d'environnement importantes

```env
# backend/.env

FLASK_SECRET_KEY=changez-en-production-32chars+
JWT_SECRET_KEY=changez-en-production-32chars+
ENCRYPTION_KEY=généré-avec-Fernet.generate_key()

GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx

ANTHROPIC_API_KEY=sk-ant-xxxx        # Pour résumés IA + agenda
OPENAI_API_KEY=sk-xxxx               # Pour Whisper (transcription vocale)

TRANSCRIPTION_PROVIDER=whisper       # ou: google

DATABASE_URL=mysql+pymysql://root:password@localhost:3306/crm_agenda
FRONTEND_URL=http://localhost:3000
```

Générer une clé Fernet :
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

---

### 5. Docker Compose (production)

```bash
# Copier .env.example → backend/.env et remplir
docker-compose up -d
```

Accès : http://localhost:3000

---

## Flux d'utilisation

```
1. Connexion Google OAuth2
       ↓
2. Autorisation lecture agenda
       ↓
3. Sync automatique (6 mois passés + 3 mois à venir)
       ↓
4. Détection automatique des clients par:
   - Participants externes
   - Patterns dans le titre ("Réunion CIPRES", "RDV - Société Alpha")
       ↓
5. Tableau de bord → liste clients + prochains RDV
       ↓
6. Fiche client → timeline chronologique
       ↓
7. Par RDV : notes écrites OU dictée vocale (→ Whisper → texte)
       ↓
8. IA Claude :
   - Résumé automatique du compte rendu
   - Ordre du jour pour le prochain RDV
   - Extraction des tâches et actions
```

---

## API REST

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/auth/google` | Démarrer OAuth2 |
| GET | `/auth/me` | Utilisateur connecté |
| POST | `/calendar/sync` | Synchroniser Calendar |
| GET | `/clients` | Lister clients (+ recherche ?q=) |
| GET | `/clients/:id` | Fiche client + meetings |
| PUT | `/clients/:id` | Modifier client |
| POST | `/clients/:id/merge` | Fusionner clients |
| GET | `/meetings` | Lister meetings |
| POST | `/notes/meeting/:id` | Créer note |
| PUT | `/notes/:id` | Modifier note |
| POST | `/voice/transcribe` | Transcrire audio |
| POST | `/ai/summarize/:id` | Résumé Claude |
| POST | `/ai/next-agenda/:id` | Ordre du jour |
| POST | `/ai/detect-tasks/:id` | Détecter tâches |

---

## Sécurité

- Tokens Google chiffrés en base (Fernet AES-128)
- JWT pour l'authentification API (access + refresh tokens)
- CORS restreint à l'URL frontend
- Aucune donnée sensible dans les logs
- Refresh automatique des tokens expirés

---

## Transcription vocale

**Whisper (OpenAI)** — recommandé pour la qualité :
```env
TRANSCRIPTION_PROVIDER=whisper
OPENAI_API_KEY=sk-xxxx
```

**Google Speech-to-Text** — alternative :
```env
TRANSCRIPTION_PROVIDER=google
GOOGLE_SPEECH_CREDENTIALS_PATH=./google-speech-credentials.json
```
Téléchargez les credentials depuis Google Cloud Console → Service Accounts.

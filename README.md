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
│   │   ├── App.tsx             # Routing (basename=/agenda en prod)
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
│   │   ├── services/api.ts     # Axios + tous les endpoints (base path dynamique)
│   │   └── store/authStore.ts  # Zustand auth
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts          # base path lu depuis VITE_BASE (env)
│   ├── Dockerfile              # ARG VITE_BASE=/agenda/
│   └── nginx.conf
│
├── docs/schema.sql             # Schéma MySQL de référence
├── docker-compose.yml          # Réseau externe wcercle_net (pas de ports exposés)
└── deploy.sh                   # Script de déploiement VPS
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
   - Origines autorisées :
     - `http://localhost:3000` (dev)
     - `https://winners-circle.vip` (prod)
   - URI de redirection :
     - `http://localhost:5000/auth/google/callback` (dev)
     - `https://winners-circle.vip/agenda/api/auth/google/callback` (prod)
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

**Développement local** (`backend/.env`) :
```env
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

**Production VPS** (`backend/.env`) :
```env
FLASK_SECRET_KEY=<clé longue et aléatoire>
JWT_SECRET_KEY=<clé longue et aléatoire>
ENCRYPTION_KEY=<généré avec Fernet.generate_key()>

GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx

ANTHROPIC_API_KEY=sk-ant-xxxx
OPENAI_API_KEY=sk-xxxx

TRANSCRIPTION_PROVIDER=whisper

DATABASE_URL=mysql+pymysql://crm_user:${MYSQL_PASSWORD}@mysql:3306/crm_agenda
FRONTEND_URL=https://winners-circle.vip/agenda
```

Générer une clé Fernet :
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

---

### 5. Docker Compose — développement local

```bash
# Copier .env.example → backend/.env et remplir
docker compose up -d
```

Accès : http://localhost:3000

---

## Déploiement VPS — winners-circle.vip/agenda

L'application est déployée en sous-chemin `/agenda` du domaine existant `winners-circle.vip`.  
Le Nginx du projet [w-circle](https://github.com/cendrinozus/w-circle) fait office de reverse proxy unique (ports 80/443).

### Architecture réseau

```
Internet → wcercle Nginx (ports 80/443)
              ├── /                  → site w-circle (statique)
              ├── /agenda/api/*      → crm_backend:5000  (Flask, strip préfixe)
              └── /agenda/*          → crm_frontend:80   (Nginx React SPA, strip préfixe)
```

Les conteneurs communiquent via le réseau Docker externe **`wcercle_net`**.  
Aucun port n'est exposé directement sur le host par crm-agenda.

### Prérequis

- VPS Debian/Ubuntu avec Docker installé
- Projet `w-circle` déjà déployé sous `/opt/wcercle` avec HTTPS actif
- DNS `winners-circle.vip` pointant vers le VPS

### Procédure

```bash
# ── 1. Créer le réseau Docker partagé (une seule fois) ─────────────────────
docker network create wcercle_net

# ── 2. Mettre à jour w-circle (depuis le repo git sur le VPS) ──────────────
cd ~/w-circle/w-circle
git pull

cp -f docs/nginx-https.conf /opt/wcercle/docs/nginx-https.conf
cp -f docs/nginx-http.conf  /opt/wcercle/docs/nginx-http.conf
cp -f docker-compose.yml    /opt/wcercle/docker-compose.yml

# Regénérer nginx-active.conf (nginx-https.conf est un template avec le mot-clé
# DOMAIN ; nginx-active.conf est le fichier réellement monté dans le conteneur)
cd /opt/wcercle
sed "s/DOMAIN/winners-circle.vip/g" docs/nginx-https.conf \
    | sudo tee docs/nginx-active.conf > /dev/null

# Recréer le conteneur web pour qu'il rejoigne wcercle_net
docker compose up -d --force-recreate web

# Vérifier que wcercle est bien sur le réseau
docker network inspect wcercle_net

# ── 3. Cloner et déployer crm-agenda ───────────────────────────────────────
git clone https://github.com/cendrinozus/crm-agenda.git ~/crm-agenda
cd ~/crm-agenda

# Remplir le .env de production
cp backend/.env.example backend/.env
nano backend/.env   # FRONTEND_URL=https://winners-circle.vip/agenda

# Lancer le script de déploiement (build, démarre, recharge Nginx)
sudo bash deploy.sh
```

Accès : **https://winners-circle.vip/agenda**

### Mise à jour

```bash
cd ~/crm-agenda
git pull
sudo bash deploy.sh
```

### Commandes utiles (depuis `/opt/crm-agenda`)

```bash
docker compose ps                  # état des conteneurs
docker compose logs -f backend     # logs Flask
docker compose logs -f frontend    # logs Nginx frontend
docker compose down                # arrêter
docker compose up -d --build       # rebuild + redémarrer
```

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

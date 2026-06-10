#!/usr/bin/env bash
# deploy.sh — Déploiement de crm-agenda sur le VPS (winners-circle.vip/agenda)
# Lancer depuis le repo git cloné sur le VPS : sudo bash deploy.sh
set -euo pipefail

DEPLOY_DIR="/opt/crm-agenda"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== CRM Agenda — déploiement ==="

# ── 1. Créer le réseau Docker partagé si absent ────────────────────────────
if ! docker network inspect wcercle_net &>/dev/null; then
    echo "[1/4] Création du réseau externe wcercle_net..."
    docker network create wcercle_net
else
    echo "[1/4] Réseau wcercle_net déjà présent."
fi

# ── 2. Copier les fichiers vers le répertoire de déploiement ──────────────
echo "[2/4] Copie vers $DEPLOY_DIR..."
if [ "$REPO_DIR" != "$DEPLOY_DIR" ]; then
    mkdir -p "$DEPLOY_DIR"
    cp -a "$REPO_DIR/." "$DEPLOY_DIR/"
    rm -rf "$DEPLOY_DIR/frontend/node_modules" \
           "$DEPLOY_DIR/frontend/dist" \
           "$DEPLOY_DIR/.git"
fi

# ── 3. Build et démarrage des conteneurs ──────────────────────────────────
echo "[3/4] Build et démarrage des conteneurs..."
cd "$DEPLOY_DIR"
docker compose build --no-cache
docker compose up -d

# ── 4. Recharger le Nginx de w-circle ─────────────────────────────────────
echo "[4/4] Rechargement de Nginx (wcercle)..."
if docker inspect wcercle &>/dev/null; then
    docker exec wcercle nginx -s reload
    echo "      Nginx rechargé."
else
    echo "      Conteneur wcercle absent — recharger manuellement depuis /opt/wcercle :"
    echo "        docker compose exec web nginx -s reload"
fi

echo ""
echo "=== Déploiement terminé ==="
echo "Application accessible sur : https://winners-circle.vip/agenda"
echo ""
echo "Commandes utiles :"
echo "  docker compose ps               # état des conteneurs"
echo "  docker compose logs -f backend  # logs backend"
echo "  docker compose logs -f frontend # logs frontend"

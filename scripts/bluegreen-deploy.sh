#!/usr/bin/env bash
set -euo pipefail

# Blue-Green Deployment Script for DZCASH
# Usage: ./scripts/bluegreen-deploy.sh [image_tag]
# Designed to run on the production server.

IMAGE_TAG="${1:-latest}"
DEPLOY_DIR="/opt/dzcash"
MARKER_FILE="${DEPLOY_DIR}/.deploy-color"

cd "${DEPLOY_DIR}"

# Determine current live color
if [[ -f "${MARKER_FILE}" ]]; then
  CURRENT=$(cat "${MARKER_FILE}")
else
  CURRENT="blue"
fi

# Switch to the opposite color
if [[ "${CURRENT}" == "blue" ]]; then
  NEW="green"
  NEW_NGINX_CONF="upstream-green.conf"
  OLD_NGINX_CONF="upstream-blue.conf"
else
  NEW="blue"
  NEW_NGINX_CONF="upstream-blue.conf"
  OLD_NGINX_CONF="upstream-green.conf"
fi

echo "=== Blue-Green Deploy ==="
echo "  Current: ${CURRENT}"
echo "  Target:  ${NEW}"
echo "  Tag:     ${IMAGE_TAG}"

# Export the image tag for compose to use
export IMAGE_TAG

# Start the new stack
echo ""
echo ">>> Deploying ${NEW} stack..."
docker compose \
  -p "dzcash-${NEW}" \
  -f docker-compose.app.yml \
  -f docker-compose.prod.yml \
  up -d --wait --remove-orphans backend frontend

# Health check — backend
echo ""
echo ">>> Health check: ${NEW} backend..."
NEW_BACKEND_CONTAINER="dzcash-${NEW}_backend_1"
if docker exec "${NEW_BACKEND_CONTAINER}" wget --no-verbose --tries=1 --spider http://localhost:4000/api/health 2>&1; then
  echo "  Backend health: OK"
else
  echo "  Backend health: FAILED — rolling back"
  docker compose -p "dzcash-${NEW}" -f docker-compose.app.yml down
  exit 1
fi

# Health check — frontend
echo ""
echo ">>> Health check: ${NEW} frontend..."
NEW_FRONTEND_CONTAINER="dzcash-${NEW}_frontend_1"
if docker exec "${NEW_FRONTEND_CONTAINER}" wget --no-verbose --tries=1 --spider http://localhost:3000 2>&1; then
  echo "  Frontend health: OK"
else
  echo "  Frontend health: FAILED — rolling back"
  docker compose -p "dzcash-${NEW}" -f docker-compose.app.yml down
  exit 1
fi

# Switch nginx traffic to new stack
echo ""
echo ">>> Switching nginx to ${NEW} stack..."
cp "nginx/${NEW_NGINX_CONF}" nginx/upstream.conf
docker exec dzcash_nginx nginx -s reload
echo "  Nginx reloaded."

# Wait a moment for nginx to pick up the new upstream
sleep 2

# Final health check through nginx
echo ""
echo ">>> Final health check via nginx proxy..."
if curl -sSf -o /dev/null http://localhost:80/api/health 2>&1; then
  echo "  End-to-end health: OK"
else
  echo "  End-to-end health: FAILED — rolling back to ${CURRENT}"
  cp "nginx/${OLD_NGINX_CONF}" nginx/upstream.conf
  docker exec dzcash_nginx nginx -s reload
  docker compose -p "dzcash-${NEW}" -f docker-compose.app.yml down
  echo "${CURRENT}" > "${MARKER_FILE}"
  exit 1
fi

# Tear down old stack
echo ""
echo ">>> Removing old ${CURRENT} stack..."
docker compose -p "dzcash-${CURRENT}" -f docker-compose.app.yml down

# Update marker
echo "${NEW}" > "${MARKER_FILE}"
echo ""
echo "=== Blue-green deploy complete! Active: ${NEW} ==="

# Clean up old images
docker system prune -f --filter "until=24h"

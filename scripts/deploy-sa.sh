#!/bin/bash
# deploy-sa.sh - Deploy script for Saudi Arabia environment
# Run by GitHub Actions self-hosted runner on push to 'sa' branch

set -e

PROJECT_DIR="/mnt/volume/projects/popper"
DOCKER_DIR="${PROJECT_DIR}/infra/docker"
TAG="${TAG:-latest}"

echo "=========================================="
echo "Popper SA Deployment"
echo "Tag: ${TAG}"
echo "Time: $(date)"
echo "=========================================="

cd "${PROJECT_DIR}"

# Pull latest changes
echo "[1/6] Pulling latest changes..."
sudo GIT_SSH_COMMAND='ssh -i /root/.ssh/github -o StrictHostKeyChecking=no' git fetch origin sa
sudo git checkout sa
sudo git reset --hard origin/sa

# Build images
echo "[2/6] Building popper-server image..."
sudo docker build \
  -f "${DOCKER_DIR}/Dockerfile.server" \
  -t "popper-server:${TAG}" \
  -t "popper-server:latest" \
  "${PROJECT_DIR}"

echo "[3/6] Building popper-queue image..."
sudo docker build \
  -f "${DOCKER_DIR}/Dockerfile.queue" \
  -t "popper-queue:${TAG}" \
  -t "popper-queue:latest" \
  "${PROJECT_DIR}"

echo "[4/6] Building popper-web image..."
sudo docker build \
  -f "${DOCKER_DIR}/Dockerfile.web" \
  -t "popper-web:${TAG}" \
  -t "popper-web:latest" \
  "${PROJECT_DIR}"

# Stop existing containers gracefully
echo "[5/6] Stopping existing containers..."
cd "${DOCKER_DIR}"
sudo docker compose -f docker-compose.sa.yml down --timeout 30 || true

# Start new containers
echo "[6/6] Starting new containers..."
sudo TAG="${TAG}" docker compose -f docker-compose.sa.yml up -d

# Cleanup old images
echo "Cleaning up old images..."
sudo docker image prune -f

# Health check
echo "Waiting for services to be healthy..."
sleep 10

# Check server health
if curl -sf http://localhost:9001/live > /dev/null; then
  echo "✅ Server is healthy"
else
  echo "❌ Server health check failed"
  exit 1
fi

# Check web health
if curl -sf http://localhost:9002 > /dev/null; then
  echo "✅ Web is healthy"
else
  echo "❌ Web health check failed"
  exit 1
fi

echo "=========================================="
echo "✅ Deployment completed successfully!"
echo "=========================================="
echo "Server: https://popper.regain.ai"
echo "Web: https://popper.regain.ai"

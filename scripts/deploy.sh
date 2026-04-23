#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Praxis Deployment ==="
echo "Project: $PROJECT_DIR"

# 1. Build backend image (context is project root for content access)
echo ""
echo "--- Building API image ---"
podman build -f "$PROJECT_DIR/api/Dockerfile" -t localhost/praxis-api:v1.0.0 "$PROJECT_DIR"

# 2. Build frontend image
echo ""
echo "--- Building Frontend image ---"
podman build -f "$PROJECT_DIR/web/Dockerfile" -t localhost/praxis-frontend:v1.0.0 "$PROJECT_DIR/web"

# 3. Save images as tarballs
echo ""
echo "--- Saving images ---"
podman save localhost/praxis-api:v1.0.0 -o /tmp/praxis-api.tar
podman save localhost/praxis-frontend:v1.0.0 -o /tmp/praxis-frontend.tar

# 4. Import into K3s containerd
echo ""
echo "--- Importing into K3s ---"
sudo k3s ctr images import /tmp/praxis-api.tar
sudo k3s ctr images import /tmp/praxis-frontend.tar

# 5. Apply K8s manifests
echo ""
echo "--- Applying K8s manifests ---"
kubectl apply -f "$PROJECT_DIR/k8s/namespace.yaml"
kubectl apply -f "$PROJECT_DIR/k8s/api-deployment.yaml"
kubectl apply -f "$PROJECT_DIR/k8s/frontend-deployment.yaml"
kubectl apply -f "$PROJECT_DIR/k8s/ingress.yaml"

# 6. Wait for rollout
echo ""
echo "--- Waiting for rollout ---"
kubectl rollout status deployment/praxis-api -n praxis --timeout=120s
kubectl rollout status deployment/praxis-frontend -n praxis --timeout=120s

echo ""
echo "=== Deployment complete ==="
echo "Frontend: http://praxis.minilab"
echo "API:      http://praxis.minilab/api/v1/taxonomy"
echo "Health:   http://praxis.minilab/api/v1/../health"

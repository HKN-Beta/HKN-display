#!/usr/bin/env bash
set -euo pipefail

REPO="purduehkn/display"
VERSION=$(node -p "require('./package.json').version || '1.0.0'")

TAG_VERSION="${REPO}:${VERSION}"
TAG_LATEST="${REPO}:latest"

echo "Running typecheck and lint..."
npm run typecheck
npm run lint

echo "Running security audit..."
npm audit --omit=dev --audit-level=high

echo "Building Docker image..."
echo "  Tag 1: ${TAG_VERSION}"
echo "  Tag 2: ${TAG_LATEST}"

docker build -t "${TAG_VERSION}" -t "${TAG_LATEST}" .

echo "Pushing images to Docker Hub (${REPO})..."
docker push "${TAG_VERSION}"
docker push "${TAG_LATEST}"

echo "Successfully built and pushed ${TAG_VERSION} and ${TAG_LATEST}."
echo ""
echo "To run the Docker image (attached to terminal & auto-removed on exit):"
echo "  docker run --rm -it -p 3000:3000 ${TAG_LATEST}"

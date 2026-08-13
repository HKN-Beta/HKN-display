#!/usr/bin/env bash
set -euo pipefail

REPO="purduehkn/display"

# Get condensed commit hash
COMMIT_HASH=$(git rev-parse --short HEAD)

if [ -z "$COMMIT_HASH" ]; then
  echo "Error: Could not retrieve git commit hash." >&2
  exit 1
fi

TAG_COMMIT="${REPO}:${COMMIT_HASH}"
TAG_LATEST="${REPO}:latest"

echo "Building Docker image..."
echo "  Tag 1: ${TAG_COMMIT}"
echo "  Tag 2: ${TAG_LATEST}"

docker build -t "${TAG_COMMIT}" -t "${TAG_LATEST}" .

echo "Pushing images to Docker Hub (${REPO})..."
docker push "${TAG_COMMIT}"
docker push "${TAG_LATEST}"

echo "Successfully built and pushed ${TAG_COMMIT} and ${TAG_LATEST}."
echo ""
echo "To run the Docker image (attached to terminal & auto-removed on exit):"
echo "  docker run --rm -it -p 3000:3000 ${TAG_LATEST}"


$ErrorActionPreference = "Stop"

$REPO = "purduehkn/display"
$COMMIT_HASH = (git rev-parse --short HEAD).Trim()

if (-not $COMMIT_HASH) {
    Write-Error "Failed to retrieve git commit hash."
    exit 1
}

$TAG_COMMIT = "${REPO}:${COMMIT_HASH}"
$TAG_LATEST = "${REPO}:latest"

Write-Host "Building Docker image..."
Write-Host "  Tag 1: ${TAG_COMMIT}"
Write-Host "  Tag 2: ${TAG_LATEST}"

docker build -t $TAG_COMMIT -t $TAG_LATEST .

Write-Host "Pushing images to Docker Hub (${REPO})..."
docker push $TAG_COMMIT
docker push $TAG_LATEST

Write-Host "Successfully built and pushed ${TAG_COMMIT} and ${TAG_LATEST}."
Write-Host ""
Write-Host "To run the Docker image (attached to terminal & auto-removed on exit):"
Write-Host "  docker run --rm -it -p 3000:3000 ${TAG_LATEST}"


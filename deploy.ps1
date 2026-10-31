<#
.SYNOPSIS
    Automated deployment script for the IEEE-HKN Beta Chapter display platform.
.DESCRIPTION
    1. Runs TypeScript verification (npm run typecheck)
    2. Runs ESLint and style auto-fixer (npm run lint)
    3. Runs npm security audit for production dependencies (halts on Critical/High)
    4. Updates program version (major.minor.patch) in package.json and package-lock.json
    5. Builds the production Docker image with version and latest tags
    6. Analyzes image security with Docker Scout (halts on Critical or High CVEs)
    7. Pushes the image to Docker Hub (purduehkn/display)
    8. Triggers Kubernetes rollout restart on HKN-NAS (ssh HKN-NAS)
.PARAMETER Version
    Explicit version to release (e.g. "1.0.1"). Must follow SemVer: major.minor.patch.
.PARAMETER Bump
    Semantic version component to increment: 'patch' (default), 'minor', or 'major'.
.PARAMETER NoPush
    If specified, builds the Docker image locally without pushing to Docker Hub or restarting k8s. (Alias: -SkipPush)
.PARAMETER SkipPush
    Alias for -NoPush. Builds the Docker image locally without pushing to Docker Hub.
.PARAMETER NoAudit
    If specified, skips the npm dependency audit step. (Alias: -SkipAudit)
.PARAMETER SkipAudit
    Alias for -NoAudit. Skips the npm dependency audit step.
.PARAMETER NoScout
    If specified, skips the Docker Scout security analysis step. (Alias: -SkipScout)
.PARAMETER SkipScout
    Alias for -NoScout. Skips the Docker Scout security analysis step.
.PARAMETER NoRestart
    If specified, skips the Kubernetes rollout restart on HKN-NAS. (Alias: -SkipRestart)
.PARAMETER SkipRestart
    Alias for -NoRestart. Skips the remote Kubernetes rollout restart.
.PARAMETER NoCache
    If specified, builds the Docker image with --no-cache to force all layers to rebuild from scratch without using cached layers.
.PARAMETER RestartOnly
    If specified, immediately triggers the Kubernetes rollout restart on the remote host without rebuilding or pushing.
.PARAMETER HelmUpgrade
    If specified, performs a helm upgrade before restarting the deployment.
.PARAMETER RemoteHost
    Remote host to SSH into for Kubernetes operations. Defaults to "HKN-NAS".
.PARAMETER Namespace
    Kubernetes namespace for the deployment. Defaults to "display".
.PARAMETER Deployment
    Kubernetes deployment name. Defaults to "display".
.PARAMETER DockerRepo
    Target Docker Hub repository name. Defaults to "purduehkn/display".
.EXAMPLE
    .\deploy.ps1
    # Bumps patch version (e.g. 1.0.0 -> 1.0.1), verifies, builds, pushes, and restarts k8s.
.EXAMPLE
    .\deploy.ps1 -NoRestart
    # Bumps patch version, verifies, builds, and pushes, but skips k8s restart.
.EXAMPLE
    .\deploy.ps1 -NoPush
    # Bumps patch version, verifies, and builds Docker image locally without pushing or restarting.
.EXAMPLE
    .\deploy.ps1 -RestartOnly
    # Directly triggers the Kubernetes rollout restart on HKN-NAS without building or pushing.
.EXAMPLE
    .\deploy.ps1 -Bump minor
    # Bumps minor version (e.g. 1.0.0 -> 1.1.0), verifies, builds, pushes, and restarts k8s.
.EXAMPLE
    .\deploy.ps1 -Version 1.2.0
    # Deploys exact version 1.2.0.
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Version,

    [Parameter()]
    [ValidateSet('patch', 'minor', 'major')]
    [string]$Bump = 'patch',

    [Parameter()]
    [Alias('SkipPush')]
    [switch]$NoPush,

    [Parameter()]
    [Alias('SkipAudit')]
    [switch]$NoAudit,

    [Parameter()]
    [Alias('SkipScout')]
    [switch]$NoScout,

    [Parameter()]
    [Alias('SkipRestart')]
    [switch]$NoRestart,

    [Parameter()]
    [switch]$NoCache,

    [Parameter()]
    [switch]$RestartOnly,

    [Parameter()]
    [switch]$HelmUpgrade,

    [Parameter()]
    [string]$RemoteHost = 'HKN-NAS',

    [Parameter()]
    [string]$Namespace = 'display',

    [Parameter()]
    [string]$Deployment = 'display',

    [Parameter()]
    [string]$DockerRepo = 'purduehkn/display'
)

$ErrorActionPreference = 'Stop'
if (Test-Path variable:global:PSNativeCommandUseErrorActionPreference) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n====> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Failure {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

try {
    # -------------------------------------------------------------
    # -1. Restart Only Shortcut
    # -------------------------------------------------------------
    if ($RestartOnly) {
        Write-Step "Triggering Kubernetes rollout restart on $RemoteHost..."
        $remoteCmd = if ($HelmUpgrade) {
            "helm upgrade --install $Deployment ./charts/$Deployment --namespace $Namespace && kubectl rollout restart deployment/$Deployment -n $Namespace && kubectl rollout status deployment/$Deployment -n $Namespace"
        } else {
            "kubectl rollout restart deployment/$Deployment -n $Namespace && kubectl rollout status deployment/$Deployment -n $Namespace"
        }

        Write-Host "  -> Executing on $RemoteHost via SSH: $remoteCmd" -ForegroundColor Cyan
        ssh $RemoteHost $remoteCmd
        if ($LASTEXITCODE -ne 0) {
            Write-Host "======================================================================" -ForegroundColor Red
            Write-Host "ERROR: Remote deployment rollout on $RemoteHost failed with exit code $LASTEXITCODE" -ForegroundColor Red
            Write-Host "======================================================================" -ForegroundColor Red
            exit $LASTEXITCODE
        }

        Write-Host "======================================================================" -ForegroundColor Cyan
        Write-Host "Kubernetes deployment rollout status successfully verified on $RemoteHost!" -ForegroundColor Green
        Write-Host "======================================================================" -ForegroundColor Cyan
        exit 0
    }

    # -------------------------------------------------------------
    # 0. Version Resolution
    # -------------------------------------------------------------
    Write-Step "Resolving target version..."
    
    $pkgPath = Join-Path $PSScriptRoot "package.json"
    if (-not (Test-Path $pkgPath)) {
        throw "package.json not found in $PSScriptRoot"
    }

    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    $currentVersion = $pkg.version
    if (-not $currentVersion) {
        $currentVersion = "1.0.0"
    }

    Write-Host "Current version: $currentVersion" -ForegroundColor Yellow

    if ($Version) {
        if ($Version -notmatch '^\d+\.\d+\.\d+$') {
            throw "Invalid version format '$Version'. Must follow major.minor.patch (e.g. 1.0.1)."
        }
        $targetVersion = $Version
    }
    else {
        $parts = $currentVersion.Split('.')
        $major = [int]$parts[0]
        $minor = [int]$parts[1]
        $patch = [int]$parts[2]

        switch ($Bump) {
            'major' { $major++; $minor = 0; $patch = 0 }
            'minor' { $minor++; $patch = 0 }
            'patch' { $patch++ }
        }

        $targetVersion = "$major.$minor.$patch"
    }

    Write-Host "Target deployment version: $targetVersion" -ForegroundColor Green

    # -------------------------------------------------------------
    # 1. Typecheck Verification
    # -------------------------------------------------------------
    Write-Step "Step 1/8: Running TypeScript typecheck..."
    npm run typecheck
    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript typecheck failed with exit code $LASTEXITCODE. Please resolve type errors before deploying."
    }
    Write-Success "TypeScript typecheck passed cleanly."

    # -------------------------------------------------------------
    # 2. Lint & Fix
    # -------------------------------------------------------------
    Write-Step "Step 2/8: Running linter and style auto-fixes..."
    npm run lint
    if ($LASTEXITCODE -ne 0) {
        throw "ESLint check/fix failed with exit code $LASTEXITCODE. Please resolve lint issues before deploying."
    }
    Write-Success "Linter checks passed cleanly."

    # -------------------------------------------------------------
    # 3. NPM Dependency Security Audit
    # -------------------------------------------------------------
    if ($NoAudit) {
        Write-Step "Step 3/8: Skipping npm audit (-NoAudit was specified)."
    }
    else {
        Write-Step "Step 3/8: Running npm dependency security audit for production dependencies..."
        
        npm audit --omit=dev --audit-level=high
        if ($LASTEXITCODE -ne 0) {
            throw "npm audit detected High or Critical vulnerabilities in production dependencies! Deployment halted."
        }
        Write-Success "npm audit passed cleanly (0 High or Critical vulnerabilities in production dependencies)."

        # Informational check for dev/build tools
        $devAudit = npm audit --json 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($devAudit -and $devAudit.metadata -and $devAudit.metadata.vulnerabilities) {
            $devCrit = [int]$devAudit.metadata.vulnerabilities.critical
            $devHigh = [int]$devAudit.metadata.vulnerabilities.high
            if ($devCrit -gt 0 -or $devHigh -gt 0) {
                Write-Host "  [INFO] Dev/build-time tools have $devCrit Critical and $devHigh High advisories (build-only tools, not deployed to runtime)." -ForegroundColor Gray
            }
        }
    }

    # -------------------------------------------------------------
    # 4. Update Program Version
    # -------------------------------------------------------------
    Write-Step "Step 4/8: Updating package version to $targetVersion..."
    npm version $targetVersion --no-git-tag-version --allow-same-version
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to update package version via npm version."
    }
    Write-Success "Updated package.json and package-lock.json to v$targetVersion."

    # -------------------------------------------------------------
    # 5. Build Docker Image
    # -------------------------------------------------------------
    $versionTag = "$($DockerRepo):$($targetVersion)"
    $latestTag = "$($DockerRepo):latest"

    # Resolve build timestamp for release metadata
    $buildTimestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

    $cacheMsg = if ($NoCache) { " (with --no-cache)" } else { "" }
    Write-Step "Step 5/8: Building Docker image ($versionTag and $latestTag)$cacheMsg..."

    $buildArgs = @(
        "build",
        "-t", $versionTag,
        "-t", $latestTag,
        "--build-arg", "BUILD_DATE=$buildTimestamp",
        "--build-arg", "VERSION=$targetVersion",
        "--label", "org.opencontainers.image.title=IEEE-HKN Beta Chapter Display",
        "--label", "org.opencontainers.image.description=Interactive display platform for IEEE-HKN Beta Chapter at Purdue University",
        "--label", "org.opencontainers.image.url=https://purduehkn.org",
        "--label", "org.opencontainers.image.vendor=IEEE-HKN Beta Chapter",
        "--label", "org.opencontainers.image.licenses=Proprietary",
        "--label", "org.opencontainers.image.version=$targetVersion",
        "--label", "org.opencontainers.image.created=$buildTimestamp"
    )
    if ($NoCache) {
        $buildArgs += "--no-cache"
    }
    $buildArgs += "."

    docker @buildArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed with exit code $LASTEXITCODE."
    }
    Write-Success "Docker image built successfully with tags: $versionTag, $latestTag."

    # -------------------------------------------------------------
    # 6. Docker Scout Vulnerability Analysis
    # -------------------------------------------------------------
    if ($NoScout) {
        Write-Step "Step 6/8: Skipping Docker Scout analysis (-NoScout was specified)."
    }
    else {
        Write-Step "Step 6/8: Running Docker Scout vulnerability scan on $latestTag (halting on Critical or High)..."
        
        docker scout cves --only-severity critical,high --exit-code $latestTag
        if ($LASTEXITCODE -ne 0) {
            throw "Docker Scout detected Critical or High severity vulnerabilities in $latestTag. Deployment halted to prevent releasing vulnerable containers."
        }
        Write-Success "Docker Scout analysis passed cleanly (0 Critical or High vulnerabilities detected)."
    }

    # -------------------------------------------------------------
    # 7. Push to Docker Hub
    # -------------------------------------------------------------
    if ($NoPush) {
        Write-Step "Step 7/8: Skipping Docker Hub upload (-NoPush was specified)."
    }
    else {
        Write-Step "Step 7/8: Pushing images to Docker Hub ($($DockerRepo))..."
        
        Write-Host "Pushing $versionTag..." -ForegroundColor Cyan
        docker push $versionTag
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to push $versionTag to Docker Hub. Ensure you are logged in ('docker login')."
        }

        Write-Host "Pushing $latestTag..." -ForegroundColor Cyan
        docker push $latestTag
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to push $latestTag to Docker Hub. Ensure you are logged in ('docker login')."
        }

        Write-Success "Images pushed successfully to Docker Hub."
    }

    # -------------------------------------------------------------
    # 8. Remote Kubernetes Rollout Restart on HKN-NAS
    # -------------------------------------------------------------
    if ($NoPush) {
        Write-Step "Step 8/8: Skipping Kubernetes rollout restart (-NoPush was specified)."
    }
    elseif (-not $NoRestart) {
        Write-Step "Step 8/8: Triggering Kubernetes rollout restart on $RemoteHost..."
        $remoteCmd = if ($HelmUpgrade) {
            "helm upgrade --install $Deployment ./charts/$Deployment --namespace $Namespace && kubectl rollout restart deployment/$Deployment -n $Namespace && kubectl rollout status deployment/$Deployment -n $Namespace"
        } else {
            "kubectl rollout restart deployment/$Deployment -n $Namespace && kubectl rollout status deployment/$Deployment -n $Namespace"
        }

        Write-Host "  -> Executing on $RemoteHost via SSH: $remoteCmd" -ForegroundColor Cyan
        ssh $RemoteHost $remoteCmd
        if ($LASTEXITCODE -ne 0) {
            Write-Host "======================================================================" -ForegroundColor Red
            Write-Host "ERROR: Remote deployment rollout on $RemoteHost failed with exit code $LASTEXITCODE" -ForegroundColor Red
            Write-Host "======================================================================" -ForegroundColor Red
            exit $LASTEXITCODE
        }

        Write-Host "======================================================================" -ForegroundColor Cyan
        Write-Host "Kubernetes deployment rollout status successfully verified on $RemoteHost!" -ForegroundColor Green
        Write-Host "======================================================================" -ForegroundColor Cyan
    }
    else {
        Write-Step "Step 8/8: Skipping Kubernetes rollout restart (-NoRestart specified)."
    }

    # -------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------
    Write-Host "`n========================================================" -ForegroundColor Green
    if ($NoPush) {
        Write-Host " Build Completed Successfully (Push Skipped)! " -ForegroundColor Green
    }
    else {
        Write-Host " Deployment Completed Successfully! " -ForegroundColor Green
        Write-Host " Repository: https://hub.docker.com/r/$DockerRepo" -ForegroundColor White
        if (-not $NoRestart) {
            Write-Host " Kubernetes: deployment/$Deployment restarted on $RemoteHost ($Namespace)" -ForegroundColor White
        }
        else {
            Write-Host " Kubernetes: Rollout restart skipped (-NoRestart)" -ForegroundColor Yellow
        }
    }
    Write-Host " Version:    v$targetVersion" -ForegroundColor White
    Write-Host " Tags:       $versionTag, $latestTag" -ForegroundColor White
    Write-Host "========================================================`n" -ForegroundColor Green

}
catch {
    Write-Failure $_.Exception.Message
    exit 1
}

# macOS Dependencies Installation Guide

This markdown file goes over how to install dependencies for the project on
****macOS****. It is important to follow these steps to ensure that the project
runs correctly.

## The Super Easy Way (install.sh)

use the install.sh script to install all dependencies for you.

```bash
chmod +x ./install.sh
./install.sh
```

## The Easy Way (Homebrew)

**Homebrew**

Homebrew is the standard package manager for macOS, allowing you to install
developer tools directly from the terminal.

If you do not have Homebrew installed, paste the following command into your
terminal:

```Bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## Node.js and npm Installation

For this project, you need Node.js 22 or newer. We recommend tracking the Long
Term Support (LTS) release channel.

To install Node.js and its bundled package manager, npm, run:

```Bash
# Install the Node.js LTS package
brew install node@22

# Verify the installation
node -v
npm -v
```

Note: If node -v throws a command not found error, Homebrew may require you to
link the package. Run `brew link node@22` to fix it.

Docker Installation Docker is required to build local application images before
they deploy to our remote cluster infrastructure. On macOS, the preferred
runtime environment is Docker Desktop.

```Bash
# Install Docker Desktop via Homebrew Cask

brew install --cask docker

# Verify the CLI binary configuration

docker --version
```

Once installed, open your Applications folder and launch Docker.app manually to
initialize the hypervisor backend.

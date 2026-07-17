#!/bin/bash
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Provisioning macOS..."
    command -v brew >/dev/null 2>&1 || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    brew install node@22 docker
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Provisioning Linux..."
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update && curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs docker-ce docker-compose-plugin
    fi
fi

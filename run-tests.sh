#!/bin/bash
# Run tests using Windows Node.js from WSL
cd "$(dirname "$0")"
WIN_PATH=$(echo "$PWD" | sed 's|/mnt/c|C:|' | sed 's|/|\\|g')
/mnt/c/nvm4w/nodejs/node.exe "${WIN_PATH}\\tests.js"

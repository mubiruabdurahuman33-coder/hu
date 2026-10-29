#!/bin/bash
# Static Hub - Build APK Script

echo "=== STATIC HUB APK BUILD ==="

# Install deps
npm install

# Install Expo CLI if not exists
if ! command -v eas &> /dev/null
then
  npm install -g eas-cli
fi

# Login (you will be asked for Expo login)
eas login

# Configure EAS
eas build:configure

# Build Android APK - preview profile
eas build --platform android --profile preview

echo "Build started - check https://expo.dev"

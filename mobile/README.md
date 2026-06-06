# CRCY Scan and Help — Responder Mobile App

React Native (Expo) Android app for CRCY Responders at EVSU Ormoc Campus.

## Setup

```bash
cd mobile
npm install
```

## Configure API URL

Edit `src/api/client.ts` and set `API_BASE` to your backend's IP:

- **Emulator**: `http://10.0.2.2:8000/api/v1` (default — maps to localhost)
- **Physical device**: `http://192.168.x.x:8000/api/v1` (your machine's LAN IP)

## Run on Emulator

```bash
npm run android
```

## Build APK (for physical device / submission)

Install EAS CLI once:
```bash
npm install -g eas-cli
eas login
```

Then build:
```bash
npm run build:apk
```

The APK download link will appear in the EAS dashboard after the build completes (~5–10 min).

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/` | Email + password → sends OTP |
| OTP | `/otp` | 6-digit code verification → JWT |
| Scanner | `/(tabs)/scanner` | Camera QR scan |
| Result | `/result` | Medical profile + guardian dial |
| Profile | `/(tabs)/profile` | View info, update name, logout |

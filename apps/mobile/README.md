# NutriByte mobile (Expo SDK 57)

This app targets **Expo SDK 57** and is designed to run in **Expo Go 57**.

## 1. Install the correct Expo Go

Expo Go only runs the SDK version it was built for. The Play Store / App Store build may
already be SDK 58, which cannot open an SDK 57 project.

| Platform | What to install |
| --- | --- |
| Android phone/emulator | [Expo Go 57.0.9 APK](https://github.com/expo/expo-go-releases/releases/download/Expo-Go-57.0.9/Expo-Go-57.0.9.apk) |
| iOS physical device | Use [EAS Go](https://expo.dev/go) and select SDK 57 |
| iOS simulator | `npx expo-go download ios 57` |

Check the SDK version in Expo Go under **Settings**. It must show **SDK 57**.

## 2. Sign in

Expo Go requires an Expo account before it will open development projects. Sign in both:

```bash
npx expo login
```

and inside the Expo Go app with the same account.

## 3. Start the backend

```bash
npm run dev:api
```

The API listens on `http://localhost:4000`. A phone cannot reach `localhost`, so the app
automatically replaces it with your computer's LAN IP (the same host Metro uses).

If detection does not work, create `.env.local`:

```bash
copy .env.example .env.local
```

and set it to your computer's Wi-Fi IPv4 address:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.3:4000
```

## 4. Start Metro and open the app

From the repo root:

```bash
npm run dev:mobile
```

or from this folder:

```bash
npm run start        # Expo Go + LAN (same Wi-Fi)
npm run start:tunnel # Expo Go + tunnel (different networks / guest Wi-Fi)
```

- Put the phone and computer on the **same Wi-Fi**.
- Allow **Node.js** through Windows Firewall for **Private** and **Public** networks, or
  allow inbound TCP **8081** (Metro) and **4000** (API).
- Scan the QR code with Expo Go (Android) or the Camera app (iOS).

If the LAN QR still cannot connect, use `npm run start:tunnel`. It requires
`@expo/ngrok`, which is already installed, and an Expo login.

## Common errors

| Error | Fix |
| --- | --- |
| `Project is incompatible with this version of Expo Go` | Install Expo Go 57.0.9 (step 1). The store build may only support SDK 58. |
| `Could not connect to development server` | Same Wi-Fi, firewall allows Node.js on ports 8081 and 4000, then restart with `--lan` or `--tunnel`. |
| QR opens but screens show network errors | Set `EXPO_PUBLIC_API_URL` to `http://<PC-LAN-IP>:4000` and restart Metro. |
| `Login required` in Expo Go | Run `npx expo login` and sign into the Expo Go app. |

## Verify the project

```bash
npm run doctor
npm run typecheck
```

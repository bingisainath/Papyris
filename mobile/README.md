# Papyris mobile (React Native)

Android and iPhone app for Papyris: sign-in with email code, chats (DMs and groups) and shared
expenses with receipt scanning. It talks to the same backend as the web app.

## Run on an Android phone (USB)

1. On the phone: Developer options → **USB debugging** on; plug it in and allow the computer.
2. Start the backend (API on port 8000) as described in the root README.
3. Then:

```bash
cd mobile
npm install
adb reverse tcp:8000 tcp:8000     # phone's localhost:8000 -> the API on this computer
adb reverse tcp:8081 tcp:8081     # phone's localhost:8081 -> Metro (JavaScript dev server)
npx react-native start            # terminal 1: Metro
npx react-native run-android      # terminal 2: build, install and open the app
```

JavaScript changes reload instantly through Metro. Native changes (new native libraries,
`android/` edits) need `run-android` again. The API address is in `src/config.ts`.

Tests: `npx jest` · types: `npx tsc --noEmit` · lint: `npx eslint src`

## Keyboard

Screens with text input use `src/hooks/useKeyboardOffset.ts` instead of `KeyboardAvoidingView`:
it measures how much the keyboard actually overlaps the screen and pads by exactly that, so it
works on edge-to-edge Android 15+, older Android that resizes the window, and iOS.

## Push notifications (Firebase)

The app builds and runs without Firebase; notifications just stay off. To switch them on:

1. Create a project at https://console.firebase.google.com (free).
2. **Android:** Add app → Android, package name `com.papyris.app`. Download
   `google-services.json` into `mobile/android/app/`, then rebuild (`npx react-native run-android`).
3. **iPhone:** Add app → iOS, bundle ID `com.papyris.app`. Download `GoogleService-Info.plist`
   into `mobile/ios/mobile/`. In Project settings → Cloud Messaging, upload your APNs key
   (Apple Developer account → Keys → new key with Apple Push Notifications service).
4. **Server:** Project settings → Service accounts → Generate new private key. Save the JSON on the
   server (never in the app or git) and set `FIREBASE_SERVICE_ACCOUNT_FILE=/path/to/it.json` in
   `backend/.env`. Restart the API and the worker.

The app asks for notification permission after sign-in, registers the phone with the server, and
opens the chat when a notification is tapped. Logging out stops notifications to that phone.

## iPhone builds

Building for iPhone needs macOS, or a cloud build service such as Expo EAS Build (works with this
bare React Native project) plus an Apple Developer account to install on devices.

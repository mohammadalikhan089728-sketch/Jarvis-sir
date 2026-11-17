# JARVIS — Native Android Studio Project (Realme 6)

> **Build Environment Notice:** This project was authored inside a cloud Node.js/TypeScript workspace that does not contain a JDK, Gradle distribution, or Android SDK. Therefore, `./gradlew assembleDebug` and physical Realme 6 verification must be run locally in Android Studio.

## 1. Setup Instructions
1. Open the `/android` folder in **Android Studio Ladybug (or newer)**.
2. Copy `local.properties.example` to `local.properties` (or export environment variables) and set:
   - `sdk.dir=/path/to/your/Android/Sdk`
   - `FIREBASE_DATABASE_URL=<your Singapore RTDB URL from Firebase Console>`
   - `JARVIS_PROXY_BASE_URL=<your deployed JARVIS backend URL>`
   - `JARVIS_GEMINI_MODEL=gemini-4-hydrogen` (never use Flash-Lite or deprecated models)
3. **Required Manual Step**: Download `google-services.json` for project `jarvis-7402c` (Android package `com.mozahid.jarvis`) from Firebase Console and place it at `android/app/google-services.json` (never fabricate this file).
4. Deploy `database.rules.json` to your Singapore Realtime Database so only authenticated owners can read/write `/users/$uid`.

## 2. Permission Instructions (Realme 6 / Realme UI)
- **Microphone / Contacts / Phone / Notifications / Camera**: Requested contextually when Mozahid triggers voice, contact lookup, calling, background tasks, or camera analysis.
- **Accessibility Service**: Open **Settings → Additional Settings → Accessibility → JARVIS Phone Automation** and enable explicitly. Required for screen reading, UI node tapping, CapCut assistance, and cross-app navigation.
- **MediaProjection**: Prompted via Android's system dialog each time screen/frame capture is initiated. Protected (`FLAG_SECURE`) apps block frame capture by OS design.
- **Realme UI Battery Optimization**: Exclude JARVIS from aggressive background freeze in *App Info → Battery Usage* so WorkManager and foreground services are not killed prematurely.

## 3. Physical-Device Testing Checklist (Requires Realme 6)
- [ ] Sign in with Firebase Auth and verify `.info/connected` turns green on Singapore RTDB.
- [ ] Verify Hinglish voice command (`"Hey Jarvis"`, `"YouTube kholo"`, `"Ali ko call karo"`) and interruptible TTS.
- [ ] Verify Accessibility node inspection and post-action verification in YouTube and CapCut.
- [ ] Verify MediaProjection single-frame capture and Gemini multimodal analysis (explicitly confirming frame-level scope).
- [ ] Verify WorkManager background task recovery after swiping the app away.

## 4. APK Build Instructions
```bash
cd android
./gradlew clean assembleDebug
# Output APK: android/app/build/outputs/apk/debug/app-debug.apk
```
To install via ADB on Realme 6 (with USB Debugging enabled):
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

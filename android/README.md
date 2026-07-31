# Gym Tracker — Android App

Native Android client built with Kotlin + Jetpack Compose + Material 3.

## Requirements

- Android Studio Ladybug (2024.2) or newer
- JDK 17 (bundled with Android Studio)
- Min SDK 26 (Android 8.0)

## Setup

1. Open the `android/` folder in Android Studio
2. Wait for Gradle sync to complete
3. Configure the server URL in `app/build.gradle.kts`:
   - For emulator: `http://10.0.2.2:3000/api/` (default, routes to host localhost)
   - For physical device on same WiFi: `http://<your-machine-ip>:3000/api/`
4. Run on device or emulator

## Architecture

- **UI**: Jetpack Compose + Material 3 + Compose Navigation
- **State**: ViewModel + StateFlow
- **Networking**: Retrofit + OkHttp + kotlinx.serialization
- **DI**: Hilt
- **Images**: Coil
- **Persistence**: DataStore Preferences (selected user)

## Screens

| Screen | Description |
|--------|-------------|
| UserSelect | Pick/create user |
| Programs | List active & completed programs |
| ProgramDetail | View program days |
| GymSession | Active workout — mark sets, edit weight/reps, notes |
| Templates | Manage workout templates |
| TemplateDetail | Edit template structure (days/exercises/sets) |
| Measurements | Body measurements with photos |
| Food | Food items list |
| FoodDetail | Cooking batches & ratio tracking |

## Building APK

```bash
# Debug APK
./gradlew assembleDebug

# Release APK (requires signing config)
./gradlew assembleRelease
```

The debug APK will be at `app/build/outputs/apk/debug/app-debug.apk`.

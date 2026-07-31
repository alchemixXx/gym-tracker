# Android App (Kotlin + Jetpack Compose) — Implementation Plan

## Overview

Native Android client for the existing gym-tracker REST API.  
Stack: Kotlin, Jetpack Compose, Material 3, Retrofit, Coroutines, Hilt.

---

## Phase 0: Environment Setup (Day 1)

- [ ] Install Android Studio (latest stable — Ladybug or newer)
- [ ] Install JDK 17 (bundled with Android Studio)
- [ ] Create a new project: "Empty Compose Activity" template
  - Package: `com.gymtracker.app`
  - Min SDK: 26 (Android 8.0 — covers 95%+ of devices)
  - Target SDK: 35
  - Build: Kotlin DSL (build.gradle.kts)
- [ ] Run "Hello World" on emulator or physical device via USB debugging
- [ ] Set up project structure (see architecture below)

### Project structure to create:
```
app/src/main/java/com/gymtracker/app/
├── GymTrackerApp.kt              ← Application class (Hilt entry point)
├── MainActivity.kt               ← Single Activity, hosts Compose
├── data/
│   ├── api/
│   │   ├── GymTrackerApi.kt     ← Retrofit interface (all endpoints)
│   │   └── ApiModule.kt         ← Hilt module providing Retrofit
│   ├── model/
│   │   ├── User.kt
│   │   ├── Template.kt
│   │   ├── Program.kt
│   │   ├── Measurement.kt
│   │   └── Food.kt
│   └── repository/
│       ├── UserRepository.kt
│       ├── TemplateRepository.kt
│       ├── ProgramRepository.kt
│       ├── MeasurementRepository.kt
│       └── FoodRepository.kt
├── ui/
│   ├── theme/
│   │   ├── Theme.kt
│   │   ├── Color.kt
│   │   └── Type.kt
│   ├── navigation/
│   │   └── NavGraph.kt
│   ├── components/              ← Shared composables
│   │   ├── LoadingScreen.kt
│   │   ├── ErrorScreen.kt
│   │   └── ConfirmDialog.kt
│   ├── users/
│   │   ├── UserSelectScreen.kt
│   │   └── UserSelectViewModel.kt
│   ├── templates/
│   │   ├── TemplatesScreen.kt
│   │   ├── TemplatesViewModel.kt
│   │   ├── TemplateDetailScreen.kt
│   │   └── TemplateDetailViewModel.kt
│   ├── programs/
│   │   ├── ProgramsScreen.kt
│   │   ├── ProgramsViewModel.kt
│   │   ├── ProgramDetailScreen.kt
│   │   ├── ProgramDetailViewModel.kt
│   │   ├── GymSessionScreen.kt
│   │   └── GymSessionViewModel.kt
│   ├── measurements/
│   │   ├── MeasurementsScreen.kt
│   │   ├── MeasurementsViewModel.kt
│   │   └── PhotoCaptureScreen.kt
│   └── food/
│       ├── FoodScreen.kt
│       ├── FoodViewModel.kt
│       ├── FoodDetailScreen.kt
│       └── FoodDetailViewModel.kt
└── util/
    └── NetworkResult.kt          ← Sealed class for Loading/Success/Error
```

---

## Phase 1: Core Infrastructure (Days 2-3)

### 1.1 Dependencies (build.gradle.kts)
```kotlin
// Compose BOM (keeps versions aligned)
implementation(platform("androidx.compose:compose-bom:2024.12.01"))
implementation("androidx.compose.material3:material3")
implementation("androidx.compose.ui:ui-tooling-preview")

// Navigation
implementation("androidx.navigation:navigation-compose:2.8.5")

// Lifecycle + ViewModel
implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")

// Retrofit + Serialization
implementation("com.squareup.retrofit2:retrofit:2.11.0")
implementation("com.squareup.okhttp3:okhttp:4.12.0")
implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")

// Hilt DI
implementation("com.google.dagger:hilt-android:2.53.1")
kapt("com.google.dagger:hilt-compiler:2.53.1")
implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

// Coil (image loading)
implementation("io.coil-kt:coil-compose:2.7.0")

// DataStore (local preferences — selected user)
implementation("androidx.datastore:datastore-preferences:1.1.1")
```

### 1.2 Data models
Map directly from your DB schema:

```kotlin
@Serializable
data class User(val id: Int, val name: String, val created_at: String)

@Serializable
data class Template(
    val id: Int, val user_id: Int, val name: String,
    val days: List<TemplateDay>? = null
)

@Serializable
data class TemplateDay(val id: Int, val name: String, val sort_order: Int, val exercises: List<TemplateExercise>? = null)

@Serializable
data class TemplateExercise(val id: Int, val name: String, val sort_order: Int, val sets: List<TemplateSet>? = null)

@Serializable
data class TemplateSet(val id: Int, val weight: Double?, val reps: Int, val count: Int, val sort_order: Int)

@Serializable
data class Program(
    val id: Int, val user_id: Int, val name: String,
    val template_id: Int?, val start_date: String?,
    val status: String, // "active" | "completed"
    val days: List<ProgramDay>? = null
)

@Serializable
data class ProgramDay(
    val id: Int, val name: String, val sort_order: Int,
    val day_note: String?, val completed_at: String?,
    val exercises: List<ProgramExercise>? = null
)

@Serializable
data class ProgramExercise(
    val id: Int, val name: String, val sort_order: Int,
    val note: String?, val sets: List<ProgramSet>? = null
)

@Serializable
data class ProgramSet(
    val id: Int, val weight: Double?, val reps: Int,
    val count: Int, val done: Boolean, val sort_order: Int
)

@Serializable
data class Measurement(
    val id: Int, val user_id: Int, val date: String,
    val weight: Double?, val notes: String?,
    val entries: List<MeasurementEntry>? = null,
    val photos: List<PhotoMeta>? = null
)

@Serializable
data class MeasurementEntry(val id: Int, val type: String, val value: Double)

@Serializable
data class PhotoMeta(val id: Int, val measurement_id: Int, val original_name: String, val mime_type: String)

@Serializable
data class FoodItem(val id: Int, val user_id: Int, val name: String)

@Serializable
data class CookingBatch(
    val id: Int, val food_item_id: Int,
    val raw_weight: Double, val cooked_weight: Double,
    val cooked_at: String, val notes: String?
)

@Serializable
data class FoodRatio(
    val food_item: FoodItem, val batch_count: Int,
    val avg_ratio: Double?, val avg_multiplier: Double?
)
```

### 1.3 Retrofit API Interface
```kotlin
interface GymTrackerApi {
    // Users
    @GET("users")
    suspend fun getUsers(): List<User>
    
    @POST("users")
    suspend fun createUser(@Body body: Map<String, String>): User

    // Templates
    @GET("users/{userId}/templates")
    suspend fun getTemplates(@Path("userId") userId: Int): List<Template>
    
    @GET("users/{userId}/templates/{id}")
    suspend fun getTemplate(@Path("userId") userId: Int, @Path("id") id: Int): Template
    
    @POST("users/{userId}/templates")
    suspend fun createTemplate(@Path("userId") userId: Int, @Body body: Any): Template
    
    @PUT("users/{userId}/templates/{id}")
    suspend fun updateTemplate(@Path("userId") userId: Int, @Path("id") id: Int, @Body body: Any): Template
    
    @DELETE("users/{userId}/templates/{id}")
    suspend fun deleteTemplate(@Path("userId") userId: Int, @Path("id") id: Int)

    // Programs
    @GET("users/{userId}/programs")
    suspend fun getPrograms(@Path("userId") userId: Int): List<Program>
    
    @GET("users/{userId}/programs/{id}")
    suspend fun getProgram(@Path("userId") userId: Int, @Path("id") id: Int): Program
    
    @POST("users/{userId}/programs")
    suspend fun createProgram(@Path("userId") userId: Int, @Body body: Any): Program
    
    @PUT("users/{userId}/programs/{id}")
    suspend fun updateProgram(@Path("userId") userId: Int, @Path("id") id: Int, @Body body: Any): Program
    
    @POST("users/{userId}/programs/{id}/duplicate")
    suspend fun duplicateProgram(@Path("userId") userId: Int, @Path("id") id: Int, @Body body: Map<String, String?>): Program
    
    @POST("users/{userId}/programs/{id}/finish")
    suspend fun finishProgram(@Path("userId") userId: Int, @Path("id") id: Int): Program
    
    @DELETE("users/{userId}/programs/{id}")
    suspend fun deleteProgram(@Path("userId") userId: Int, @Path("id") id: Int)

    // Program session actions
    @PUT("users/{userId}/programs/{programId}/days/{dayId}")
    suspend fun updateDay(@Path("userId") userId: Int, @Path("programId") programId: Int, @Path("dayId") dayId: Int, @Body body: Any): ProgramDay
    
    @PUT("users/{userId}/programs/{programId}/days/{dayId}/exercises/{exId}")
    suspend fun updateExercise(@Path("userId") userId: Int, @Path("programId") programId: Int, @Path("dayId") dayId: Int, @Path("exId") exId: Int, @Body body: Map<String, String?>): ProgramExercise
    
    @PUT("users/{userId}/programs/{programId}/days/{dayId}/exercises/{exId}/sets/{setId}")
    suspend fun updateSet(@Path("userId") userId: Int, @Path("programId") programId: Int, @Path("dayId") dayId: Int, @Path("exId") exId: Int, @Path("setId") setId: Int, @Body body: Any): ProgramSet

    // Exercise/Day history
    @GET("users/{userId}/programs/{programId}/exercise-history")
    suspend fun getExerciseHistory(@Path("userId") userId: Int, @Path("programId") programId: Int, @Query("dayName") dayName: String, @Query("exerciseName") exerciseName: String): List<Any>
    
    @GET("users/{userId}/programs/{programId}/day-history")
    suspend fun getDayHistory(@Path("userId") userId: Int, @Path("programId") programId: Int, @Query("dayName") dayName: String): List<Any>

    // Measurements
    @GET("users/{userId}/measurements")
    suspend fun getMeasurements(@Path("userId") userId: Int): List<Measurement>
    
    @POST("users/{userId}/measurements")
    suspend fun createMeasurement(@Path("userId") userId: Int, @Body body: Any): Measurement
    
    @DELETE("users/{userId}/measurements/{id}")
    suspend fun deleteMeasurement(@Path("userId") userId: Int, @Path("id") id: Int)

    // Photos
    @Multipart
    @POST("users/{userId}/measurements/{measurementId}/photos")
    suspend fun uploadPhotos(@Path("userId") userId: Int, @Path("measurementId") measurementId: Int, @Part photos: List<MultipartBody.Part>): List<PhotoMeta>
    
    @DELETE("users/{userId}/measurements/{measurementId}/photos/{photoId}")
    suspend fun deletePhoto(@Path("userId") userId: Int, @Path("measurementId") measurementId: Int, @Path("photoId") photoId: Int)

    // Food
    @GET("users/{userId}/food-items")
    suspend fun getFoodItems(@Path("userId") userId: Int): List<FoodItem>
    
    @POST("users/{userId}/food-items")
    suspend fun createFoodItem(@Path("userId") userId: Int, @Body body: Map<String, String>): FoodItem
    
    @PUT("users/{userId}/food-items/{id}")
    suspend fun updateFoodItem(@Path("userId") userId: Int, @Path("id") id: Int, @Body body: Map<String, String>): FoodItem
    
    @DELETE("users/{userId}/food-items/{id}")
    suspend fun deleteFoodItem(@Path("userId") userId: Int, @Path("id") id: Int)

    // Batches
    @GET("users/{userId}/food-items/{id}/batches")
    suspend fun getBatches(@Path("userId") userId: Int, @Path("id") foodItemId: Int): List<CookingBatch>
    
    @POST("users/{userId}/food-items/{id}/batches")
    suspend fun createBatch(@Path("userId") userId: Int, @Path("id") foodItemId: Int, @Body body: Any): CookingBatch
    
    @DELETE("users/{userId}/food-items/{id}/batches/{batchId}")
    suspend fun deleteBatch(@Path("userId") userId: Int, @Path("id") foodItemId: Int, @Path("batchId") batchId: Int)
    
    @GET("users/{userId}/food-items/{id}/ratio")
    suspend fun getFoodRatio(@Path("userId") userId: Int, @Path("id") foodItemId: Int): FoodRatio
}
```

### 1.4 NetworkResult utility
```kotlin
sealed class NetworkResult<out T> {
    object Loading : NetworkResult<Nothing>()
    data class Success<T>(val data: T) : NetworkResult<T>()
    data class Error(val message: String) : NetworkResult<Nothing>()
}
```

### 1.5 Hilt ApiModule
- Provide Retrofit instance with base URL (configurable via BuildConfig)
- OkHttp with logging interceptor (debug builds)
- kotlinx.serialization converter

### 1.6 Server URL configuration
- Use BuildConfig field so you can switch between local (10.0.2.2:3000 for emulator) and production URL
- Consider adding a Settings screen later to change server URL at runtime

---

## Phase 2: User Selection & Navigation Shell (Days 4-5)

### 2.1 Navigation setup
```
NavGraph routes:
  "users"            → UserSelectScreen
  "templates"        → TemplatesScreen
  "templates/{id}"   → TemplateDetailScreen
  "programs"         → ProgramsScreen
  "programs/{id}"    → ProgramDetailScreen
  "session/{id}/{dayId}" → GymSessionScreen
  "measurements"     → MeasurementsScreen
  "food"             → FoodScreen
  "food/{id}"        → FoodDetailScreen
```

### 2.2 UserSelectScreen
- List of users from API
- "Add user" button → dialog with name input
- Tap user → save selection to DataStore, navigate to main app
- Simple, clean Material 3 list

### 2.3 Main scaffold (after user selected)
- Bottom navigation bar with 4 tabs: Programs, Templates, Measurements, Food
- Each tab has its own nested nav graph
- App bar shows current user name, with option to switch user

---

## Phase 3: Templates (Days 6-8)

### 3.1 TemplatesScreen (list)
- LazyColumn showing templates
- FAB to create new template
- Swipe-to-delete or long-press menu
- Pull-to-refresh

### 3.2 TemplateDetailScreen (create/edit)
- Template name field
- Dynamic list of days, each with:
  - Day name field
  - List of exercises, each with:
    - Exercise name field
    - List of sets (weight × reps × count)
    - "Add set" button
  - "Add exercise" button
- "Add day" button
- Save button
- This is the most form-heavy screen — good practice for Compose state management

### Key learning here:
- Managing nested mutable state in Compose
- `rememberSaveable` for surviving rotation
- Keyboard handling (numeric inputs for weight/reps)

---

## Phase 4: Programs (Days 9-12)

### 4.1 ProgramsScreen (list)
- Shows active and completed programs (tabs or filter chip)
- "New program" → dialog to pick template + name + start date
- Program cards show: name, start date, status, days progress
- Actions: duplicate, finish, delete

### 4.2 ProgramDetailScreen
- Shows program structure (days with exercises)
- Each day: tap to open GymSession if not completed, or view if completed
- Shows completed_at date for finished days
- Edit program structure button (only for active programs)

### 4.3 GymSessionScreen ⭐ (most complex)
This is where you actually work out. Key interactions:
- View current day's exercises and sets
- Mark sets as done (checkbox/toggle)
- Edit weight/reps inline during workout
- Add notes to exercises
- Add day note
- View exercise history (notes from past 3 sessions — modal/bottom sheet)
- View day history
- "Complete day" button → marks day with completed_at timestamp

UI considerations:
- Large touch targets (tapping during workout with sweaty hands)
- High contrast for gym lighting
- Minimal navigation — everything on one scrollable screen
- Maybe a "compact mode" with just checkboxes visible

---

## Phase 5: Measurements (Days 13-15)

### 5.1 MeasurementsScreen
- List of measurements sorted by date (newest first)
- Each card shows: date, weight, entry types+values, photo count
- "Add measurement" FAB
- Tap measurement → expand to see details + photos
- Delete option

### 5.2 Add measurement flow
- Date picker (default today)
- Weight field (optional)
- Dynamic entries list (type selector + value field)
  - Types: bicep, chest, waist, hips, thigh, etc.
- Notes field
- Save, then optionally add photos

### 5.3 Photo integration
- Use CameraX or system camera intent to take progress photos
- Gallery picker as alternative
- Upload to API as multipart
- Display photos using Coil, loading from `/api/photos/{id}/image`
- Delete photos

---

## Phase 6: Food Tracking (Days 16-17)

### 6.1 FoodScreen (list)
- List of food items
- "Add food item" → name input dialog
- Each item shows name + latest ratio if available
- Tap → FoodDetailScreen
- Edit name (inline or dialog)
- Delete with confirmation

### 6.2 FoodDetailScreen
- Shows food item name (editable)
- Average ratio display (raw/cooked multiplier)
- List of cooking batches: raw weight → cooked weight, date, notes
- "Add batch" form: raw weight, cooked weight, notes
- Delete batch

---

## Phase 7: Polish & QA (Days 18-21)

### 7.1 Error handling
- Snackbar for network errors
- Retry buttons on failure states
- Offline detection (show banner when no connectivity)
- Loading skeletons or shimmer for lists

### 7.2 UX polish
- Pull-to-refresh on all list screens
- Smooth transitions between screens (Compose shared element transitions)
- Haptic feedback on set completion
- Keyboard management (auto-focus, next field, dismiss)
- Dark theme support (Material 3 dynamic color from wallpaper)

### 7.3 Gym-specific UX
- Keep screen on during GymSession (FLAG_KEEP_SCREEN_ON)
- Large text/buttons for the session screen
- Quick-toggle between exercises without losing scroll position

### 7.4 Testing
- Manual testing on physical device
- Test all API endpoints through the app
- Test edge cases: empty lists, long names, large photos
- Test on different screen sizes (phone vs tablet)

### 7.5 Build release APK
- Configure signing (debug keystore for personal use is fine)
- ProGuard/R8 minification
- Generate APK or AAB
- Install on your phone

---

## Phase 8 (Optional, future): Enhancements

- [ ] Offline-first with Room database + sync
- [ ] Push notifications (workout reminders)
- [ ] Widgets (today's workout at a glance)
- [ ] Biometric lock (if sharing the device)
- [ ] Simple API key auth (protect the server)
- [ ] Export data to CSV
- [ ] Wear OS companion (just set checkboxes from watch)
- [ ] Home screen shortcut to current program's next day

---

## Server-Side Prerequisites

Before using the Android app, ensure:

1. **Server is accessible from your phone's network**
   - If local dev: your phone and server on same WiFi, use your machine's local IP (e.g. `192.168.1.x:3000`)
   - If deployed: use the public URL

2. **CORS is already enabled** (your server has `app.use(cors())`) — no changes needed

3. **Optional: Add API key middleware** for basic security
   ```typescript
   // Simple API key check (add to server/src/index.ts)
   app.use('/api', (req, res, next) => {
     const key = req.headers['x-api-key'];
     if (key !== process.env.API_KEY) return res.status(401).json({ error: 'Unauthorized' });
     next();
   });
   ```

---

## Resources for Learning

### Kotlin basics (1-2 days)
- Kotlin Koans: https://kotlinlang.org/docs/koans.html
- Kotlin for TypeScript developers (mental mapping)

### Jetpack Compose (2-3 days)
- Official tutorial: https://developer.android.com/jetpack/compose/tutorial
- Compose pathway: https://developer.android.com/courses/pathways/compose
- "Now in Android" sample app (great reference architecture)

### Architecture
- Guide to app architecture: https://developer.android.com/topic/architecture
- "Now in Android" on GitHub: https://github.com/android/nowinandroid

---

## Summary

| Phase | What | Days | Screens |
|-------|------|------|---------|
| 0 | Setup | 1 | — |
| 1 | Infrastructure | 2 | — |
| 2 | Navigation + Users | 2 | 1 screen |
| 3 | Templates | 3 | 2 screens |
| 4 | Programs + Session | 4 | 3 screens |
| 5 | Measurements | 3 | 2 screens |
| 6 | Food | 2 | 2 screens |
| 7 | Polish | 4 | — |
| **Total** | | **~21 days** | **10 screens** |

Realistic timeline with learning: **3-4 weeks** of evening/weekend work.
If you already knew Kotlin: **2 weeks**.

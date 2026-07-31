package com.gymtracker.app.data.api

import com.gymtracker.app.data.model.*
import okhttp3.MultipartBody
import retrofit2.http.*

interface GymTrackerApi {

    // ─── Users ───────────────────────────────────────────────────────────────────

    @GET("users")
    suspend fun getUsers(): List<User>

    @POST("users")
    suspend fun createUser(@Body body: Map<String, String>): User

    // ─── Templates ───────────────────────────────────────────────────────────────

    @GET("users/{userId}/templates")
    suspend fun getTemplates(@Path("userId") userId: Int): List<Template>

    @GET("users/{userId}/templates/{id}")
    suspend fun getTemplate(
        @Path("userId") userId: Int,
        @Path("id") id: Int
    ): Template

    @POST("users/{userId}/templates")
    suspend fun createTemplate(
        @Path("userId") userId: Int,
        @Body body: CreateTemplateRequest
    ): Template

    @PUT("users/{userId}/templates/{id}")
    suspend fun updateTemplate(
        @Path("userId") userId: Int,
        @Path("id") id: Int,
        @Body body: CreateTemplateRequest
    ): Template

    @DELETE("users/{userId}/templates/{id}")
    suspend fun deleteTemplate(
        @Path("userId") userId: Int,
        @Path("id") id: Int
    )

    // ─── Programs ────────────────────────────────────────────────────────────────

    @GET("users/{userId}/programs")
    suspend fun getPrograms(@Path("userId") userId: Int): List<Program>

    @GET("users/{userId}/programs/{id}")
    suspend fun getProgram(
        @Path("userId") userId: Int,
        @Path("id") id: Int
    ): Program

    @POST("users/{userId}/programs")
    suspend fun createProgram(
        @Path("userId") userId: Int,
        @Body body: CreateProgramRequest
    ): Program

    @PUT("users/{userId}/programs/{id}")
    suspend fun updateProgram(
        @Path("userId") userId: Int,
        @Path("id") id: Int,
        @Body body: UpdateProgramRequest
    ): Program

    @POST("users/{userId}/programs/{id}/duplicate")
    suspend fun duplicateProgram(
        @Path("userId") userId: Int,
        @Path("id") id: Int,
        @Body body: DuplicateProgramRequest
    ): Program

    @POST("users/{userId}/programs/{id}/finish")
    suspend fun finishProgram(
        @Path("userId") userId: Int,
        @Path("id") id: Int
    ): Program

    @DELETE("users/{userId}/programs/{id}")
    suspend fun deleteProgram(
        @Path("userId") userId: Int,
        @Path("id") id: Int
    )

    // ─── Program Session ─────────────────────────────────────────────────────────

    @PUT("users/{userId}/programs/{programId}/days/{dayId}")
    suspend fun updateDay(
        @Path("userId") userId: Int,
        @Path("programId") programId: Int,
        @Path("dayId") dayId: Int,
        @Body body: UpdateDayRequest
    ): ProgramDay

    @PUT("users/{userId}/programs/{programId}/days/{dayId}/exercises/{exId}")
    suspend fun updateExercise(
        @Path("userId") userId: Int,
        @Path("programId") programId: Int,
        @Path("dayId") dayId: Int,
        @Path("exId") exId: Int,
        @Body body: UpdateExerciseRequest
    ): ProgramExercise

    @PUT("users/{userId}/programs/{programId}/days/{dayId}/exercises/{exId}/sets/{setId}")
    suspend fun updateSet(
        @Path("userId") userId: Int,
        @Path("programId") programId: Int,
        @Path("dayId") dayId: Int,
        @Path("exId") exId: Int,
        @Path("setId") setId: Int,
        @Body body: UpdateSetRequest
    ): ProgramSet

    // ─── History ─────────────────────────────────────────────────────────────────

    @GET("users/{userId}/programs/{programId}/exercise-history")
    suspend fun getExerciseHistory(
        @Path("userId") userId: Int,
        @Path("programId") programId: Int,
        @Query("dayName") dayName: String,
        @Query("exerciseName") exerciseName: String
    ): List<ExerciseHistory>

    @GET("users/{userId}/programs/{programId}/day-history")
    suspend fun getDayHistory(
        @Path("userId") userId: Int,
        @Path("programId") programId: Int,
        @Query("dayName") dayName: String
    ): List<DayHistory>

    // ─── Measurements ────────────────────────────────────────────────────────────

    @GET("users/{userId}/measurements")
    suspend fun getMeasurements(@Path("userId") userId: Int): List<Measurement>

    @POST("users/{userId}/measurements")
    suspend fun createMeasurement(
        @Path("userId") userId: Int,
        @Body body: CreateMeasurementRequest
    ): Measurement

    @DELETE("users/{userId}/measurements/{id}")
    suspend fun deleteMeasurement(
        @Path("userId") userId: Int,
        @Path("id") id: Int
    )

    // ─── Photos ──────────────────────────────────────────────────────────────────

    @Multipart
    @POST("users/{userId}/measurements/{measurementId}/photos")
    suspend fun uploadPhotos(
        @Path("userId") userId: Int,
        @Path("measurementId") measurementId: Int,
        @Part photos: List<MultipartBody.Part>
    ): List<PhotoMeta>

    @DELETE("users/{userId}/measurements/{measurementId}/photos/{photoId}")
    suspend fun deletePhoto(
        @Path("userId") userId: Int,
        @Path("measurementId") measurementId: Int,
        @Path("photoId") photoId: Int
    )

    // ─── Food ────────────────────────────────────────────────────────────────────

    @GET("users/{userId}/food-items")
    suspend fun getFoodItems(@Path("userId") userId: Int): List<FoodItem>

    @POST("users/{userId}/food-items")
    suspend fun createFoodItem(
        @Path("userId") userId: Int,
        @Body body: Map<String, String>
    ): FoodItem

    @PUT("users/{userId}/food-items/{id}")
    suspend fun updateFoodItem(
        @Path("userId") userId: Int,
        @Path("id") id: Int,
        @Body body: Map<String, String>
    ): FoodItem

    @DELETE("users/{userId}/food-items/{id}")
    suspend fun deleteFoodItem(
        @Path("userId") userId: Int,
        @Path("id") id: Int
    )

    // ─── Batches ─────────────────────────────────────────────────────────────────

    @GET("users/{userId}/food-items/{id}/batches")
    suspend fun getBatches(
        @Path("userId") userId: Int,
        @Path("id") foodItemId: Int
    ): List<CookingBatch>

    @POST("users/{userId}/food-items/{id}/batches")
    suspend fun createBatch(
        @Path("userId") userId: Int,
        @Path("id") foodItemId: Int,
        @Body body: CreateBatchRequest
    ): CookingBatch

    @DELETE("users/{userId}/food-items/{id}/batches/{batchId}")
    suspend fun deleteBatch(
        @Path("userId") userId: Int,
        @Path("id") foodItemId: Int,
        @Path("batchId") batchId: Int
    )

    @GET("users/{userId}/food-items/{id}/ratio")
    suspend fun getFoodRatio(
        @Path("userId") userId: Int,
        @Path("id") foodItemId: Int
    ): FoodRatio
}

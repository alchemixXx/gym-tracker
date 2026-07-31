package com.gymtracker.app.data.repository

import com.gymtracker.app.data.api.GymTrackerApi
import com.gymtracker.app.data.model.CreateMeasurementRequest
import com.gymtracker.app.data.model.Measurement
import com.gymtracker.app.data.model.PhotoMeta
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MeasurementRepository @Inject constructor(
    private val api: GymTrackerApi
) {
    suspend fun getMeasurements(userId: Int): List<Measurement> =
        api.getMeasurements(userId)

    suspend fun createMeasurement(userId: Int, request: CreateMeasurementRequest): Measurement =
        api.createMeasurement(userId, request)

    suspend fun deleteMeasurement(userId: Int, id: Int) =
        api.deleteMeasurement(userId, id)

    suspend fun uploadPhotos(
        userId: Int,
        measurementId: Int,
        photos: List<Pair<String, ByteArray>> // filename to bytes
    ): List<PhotoMeta> {
        val parts = photos.map { (filename, bytes) ->
            val mediaType = when {
                filename.endsWith(".png", ignoreCase = true) -> "image/png"
                filename.endsWith(".webp", ignoreCase = true) -> "image/webp"
                else -> "image/jpeg"
            }.toMediaTypeOrNull()

            val body = bytes.toRequestBody(mediaType)
            MultipartBody.Part.createFormData("photos", filename, body)
        }
        return api.uploadPhotos(userId, measurementId, parts)
    }

    suspend fun deletePhoto(userId: Int, measurementId: Int, photoId: Int) =
        api.deletePhoto(userId, measurementId, photoId)
}

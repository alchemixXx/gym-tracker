package com.gymtracker.app.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Measurement(
    val id: Int,
    val user_id: Int,
    val date: String,
    val weight: Double? = null,
    val notes: String? = null,
    val created_at: String? = null,
    val entries: List<MeasurementEntry>? = null,
    val photos: List<PhotoMeta>? = null
)

@Serializable
data class MeasurementEntry(
    val id: Int,
    val measurement_id: Int? = null,
    val type: String,
    val value: Double
)

@Serializable
data class PhotoMeta(
    val id: Int,
    val measurement_id: Int,
    val original_name: String,
    val mime_type: String,
    val created_at: String? = null
)

@Serializable
data class CreateMeasurementRequest(
    val date: String? = null,
    val weight: Double? = null,
    val notes: String? = null,
    val entries: List<CreateMeasurementEntryRequest>? = null
)

@Serializable
data class CreateMeasurementEntryRequest(
    val type: String,
    val value: Double
)

package com.gymtracker.app.data.model

import kotlinx.serialization.Serializable

@Serializable
data class FoodItem(
    val id: Int,
    val user_id: Int,
    val name: String,
    val created_at: String? = null
)

@Serializable
data class CookingBatch(
    val id: Int,
    val food_item_id: Int,
    val raw_weight: Double,
    val cooked_weight: Double,
    val cooked_at: String? = null,
    val notes: String? = null
)

@Serializable
data class FoodRatio(
    val food_item: FoodItem,
    val batch_count: Int,
    val avg_ratio: Double? = null,
    val avg_multiplier: Double? = null
)

@Serializable
data class CreateBatchRequest(
    val raw_weight: Double,
    val cooked_weight: Double,
    val notes: String? = null
)

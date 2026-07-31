package com.gymtracker.app.data.repository

import com.gymtracker.app.data.api.GymTrackerApi
import com.gymtracker.app.data.model.CookingBatch
import com.gymtracker.app.data.model.CreateBatchRequest
import com.gymtracker.app.data.model.FoodItem
import com.gymtracker.app.data.model.FoodRatio
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FoodRepository @Inject constructor(
    private val api: GymTrackerApi
) {
    suspend fun getFoodItems(userId: Int): List<FoodItem> =
        api.getFoodItems(userId)

    suspend fun createFoodItem(userId: Int, name: String): FoodItem =
        api.createFoodItem(userId, mapOf("name" to name))

    suspend fun updateFoodItem(userId: Int, id: Int, name: String): FoodItem =
        api.updateFoodItem(userId, id, mapOf("name" to name))

    suspend fun deleteFoodItem(userId: Int, id: Int) =
        api.deleteFoodItem(userId, id)

    suspend fun getBatches(userId: Int, foodItemId: Int): List<CookingBatch> =
        api.getBatches(userId, foodItemId)

    suspend fun createBatch(userId: Int, foodItemId: Int, request: CreateBatchRequest): CookingBatch =
        api.createBatch(userId, foodItemId, request)

    suspend fun deleteBatch(userId: Int, foodItemId: Int, batchId: Int) =
        api.deleteBatch(userId, foodItemId, batchId)

    suspend fun getFoodRatio(userId: Int, foodItemId: Int): FoodRatio =
        api.getFoodRatio(userId, foodItemId)
}

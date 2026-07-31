package com.gymtracker.app.ui.food

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gymtracker.app.data.model.CookingBatch
import com.gymtracker.app.data.model.CreateBatchRequest
import com.gymtracker.app.data.model.FoodItem
import com.gymtracker.app.data.model.FoodRatio
import com.gymtracker.app.data.repository.FoodRepository
import com.gymtracker.app.data.repository.UserRepository
import com.gymtracker.app.util.NetworkResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FoodDetailState(
    val foodItem: FoodItem? = null,
    val batches: List<CookingBatch> = emptyList(),
    val ratio: FoodRatio? = null
)

@HiltViewModel
class FoodDetailViewModel @Inject constructor(
    private val foodRepository: FoodRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _loadState = MutableStateFlow<NetworkResult<FoodDetailState>>(NetworkResult.Loading)
    val loadState: StateFlow<NetworkResult<FoodDetailState>> = _loadState.asStateFlow()

    private val _detailState = MutableStateFlow(FoodDetailState())
    val detailState: StateFlow<FoodDetailState> = _detailState.asStateFlow()

    private val _showAddBatchDialog = MutableStateFlow(false)
    val showAddBatchDialog: StateFlow<Boolean> = _showAddBatchDialog.asStateFlow()

    private val _showRenameDialog = MutableStateFlow(false)
    val showRenameDialog: StateFlow<Boolean> = _showRenameDialog.asStateFlow()

    private var userId: Int = 0
    private var foodItemId: Int = 0

    fun loadFoodDetail(foodItemId: Int) {
        this.foodItemId = foodItemId
        viewModelScope.launch {
            _loadState.value = NetworkResult.Loading
            try {
                userId = userRepository.selectedUserId.first() ?: return@launch
                val items = foodRepository.getFoodItems(userId)
                val foodItem = items.find { it.id == foodItemId }
                val batches = foodRepository.getBatches(userId, foodItemId)
                val ratio = try { foodRepository.getFoodRatio(userId, foodItemId) } catch (_: Exception) { null }

                _detailState.value = FoodDetailState(foodItem = foodItem, batches = batches, ratio = ratio)
                _loadState.value = NetworkResult.Success(_detailState.value)
            } catch (e: Exception) {
                _loadState.value = NetworkResult.Error(e.message ?: "Failed to load food detail")
            }
        }
    }

    fun showAddBatchDialog() { _showAddBatchDialog.value = true }
    fun hideAddBatchDialog() { _showAddBatchDialog.value = false }

    fun showRenameDialog() { _showRenameDialog.value = true }
    fun hideRenameDialog() { _showRenameDialog.value = false }

    fun renameFoodItem(name: String) {
        viewModelScope.launch {
            try {
                foodRepository.updateFoodItem(userId, foodItemId, name)
                hideRenameDialog()
                loadFoodDetail(foodItemId)
            } catch (_: Exception) {}
        }
    }

    fun createBatch(rawWeight: Double, cookedWeight: Double, notes: String?) {
        viewModelScope.launch {
            try {
                foodRepository.createBatch(
                    userId, foodItemId,
                    CreateBatchRequest(
                        raw_weight = rawWeight,
                        cooked_weight = cookedWeight,
                        notes = notes?.takeIf { it.isNotBlank() }
                    )
                )
                hideAddBatchDialog()
                loadFoodDetail(foodItemId)
            } catch (_: Exception) {}
        }
    }

    fun deleteBatch(batchId: Int) {
        viewModelScope.launch {
            try {
                foodRepository.deleteBatch(userId, foodItemId, batchId)
                loadFoodDetail(foodItemId)
            } catch (_: Exception) {}
        }
    }
}

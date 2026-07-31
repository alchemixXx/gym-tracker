package com.gymtracker.app.ui.food

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gymtracker.app.data.model.FoodItem
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

@HiltViewModel
class FoodViewModel @Inject constructor(
    private val foodRepository: FoodRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _foodItemsState = MutableStateFlow<NetworkResult<List<FoodItem>>>(NetworkResult.Loading)
    val foodItemsState: StateFlow<NetworkResult<List<FoodItem>>> = _foodItemsState.asStateFlow()

    private val _showAddDialog = MutableStateFlow(false)
    val showAddDialog: StateFlow<Boolean> = _showAddDialog.asStateFlow()

    init {
        loadFoodItems()
    }

    fun loadFoodItems() {
        viewModelScope.launch {
            _foodItemsState.value = NetworkResult.Loading
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                val items = foodRepository.getFoodItems(userId)
                _foodItemsState.value = NetworkResult.Success(items)
            } catch (e: Exception) {
                _foodItemsState.value = NetworkResult.Error(e.message ?: "Failed to load food items")
            }
        }
    }

    fun showAddDialog() { _showAddDialog.value = true }
    fun hideAddDialog() { _showAddDialog.value = false }

    fun createFoodItem(name: String) {
        viewModelScope.launch {
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                foodRepository.createFoodItem(userId, name)
                hideAddDialog()
                loadFoodItems()
            } catch (_: Exception) {}
        }
    }

    fun deleteFoodItem(id: Int) {
        viewModelScope.launch {
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                foodRepository.deleteFoodItem(userId, id)
                loadFoodItems()
            } catch (_: Exception) {}
        }
    }
}

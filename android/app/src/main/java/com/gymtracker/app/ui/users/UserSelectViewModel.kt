package com.gymtracker.app.ui.users

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gymtracker.app.data.model.User
import com.gymtracker.app.data.repository.UserRepository
import com.gymtracker.app.util.NetworkResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class UserSelectViewModel @Inject constructor(
    private val userRepository: UserRepository
) : ViewModel() {

    private val _usersState = MutableStateFlow<NetworkResult<List<User>>>(NetworkResult.Loading)
    val usersState: StateFlow<NetworkResult<List<User>>> = _usersState.asStateFlow()

    private val _showAddDialog = MutableStateFlow(false)
    val showAddDialog: StateFlow<Boolean> = _showAddDialog.asStateFlow()

    init {
        loadUsers()
    }

    fun loadUsers() {
        viewModelScope.launch {
            _usersState.value = NetworkResult.Loading
            try {
                val users = userRepository.getUsers()
                _usersState.value = NetworkResult.Success(users)
            } catch (e: Exception) {
                _usersState.value = NetworkResult.Error(e.message ?: "Failed to load users")
            }
        }
    }

    fun selectUser(user: User) {
        viewModelScope.launch {
            userRepository.selectUser(user)
        }
    }

    fun showAddUserDialog() {
        _showAddDialog.value = true
    }

    fun hideAddUserDialog() {
        _showAddDialog.value = false
    }

    fun createUser(name: String) {
        viewModelScope.launch {
            try {
                val user = userRepository.createUser(name)
                // Refresh list
                loadUsers()
                hideAddUserDialog()
            } catch (e: Exception) {
                // Could show error snackbar here
            }
        }
    }
}

package com.gymtracker.app.ui.programs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gymtracker.app.data.model.Program
import com.gymtracker.app.data.repository.ProgramRepository
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
class ProgramDetailViewModel @Inject constructor(
    private val programRepository: ProgramRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _programState = MutableStateFlow<NetworkResult<Program>>(NetworkResult.Loading)
    val programState: StateFlow<NetworkResult<Program>> = _programState.asStateFlow()

    fun loadProgram(programId: Int) {
        viewModelScope.launch {
            _programState.value = NetworkResult.Loading
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                val program = programRepository.getProgram(userId, programId)
                _programState.value = NetworkResult.Success(program)
            } catch (e: Exception) {
                _programState.value = NetworkResult.Error(e.message ?: "Failed to load program")
            }
        }
    }
}

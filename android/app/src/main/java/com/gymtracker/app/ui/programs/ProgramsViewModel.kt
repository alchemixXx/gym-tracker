package com.gymtracker.app.ui.programs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gymtracker.app.data.model.CreateProgramRequest
import com.gymtracker.app.data.model.Program
import com.gymtracker.app.data.model.Template
import com.gymtracker.app.data.repository.ProgramRepository
import com.gymtracker.app.data.repository.TemplateRepository
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
class ProgramsViewModel @Inject constructor(
    private val programRepository: ProgramRepository,
    private val templateRepository: TemplateRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _programsState = MutableStateFlow<NetworkResult<List<Program>>>(NetworkResult.Loading)
    val programsState: StateFlow<NetworkResult<List<Program>>> = _programsState.asStateFlow()

    private val _templates = MutableStateFlow<List<Template>>(emptyList())
    val templates: StateFlow<List<Template>> = _templates.asStateFlow()

    private val _showCreateDialog = MutableStateFlow(false)
    val showCreateDialog: StateFlow<Boolean> = _showCreateDialog.asStateFlow()

    private val _userName = MutableStateFlow("")
    val userName: StateFlow<String> = _userName.asStateFlow()

    init {
        loadPrograms()
        loadTemplates()
        loadUserName()
    }

    private fun loadUserName() {
        viewModelScope.launch {
            userRepository.selectedUserName.collect { name ->
                _userName.value = name ?: ""
            }
        }
    }

    fun loadPrograms() {
        viewModelScope.launch {
            _programsState.value = NetworkResult.Loading
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                val programs = programRepository.getPrograms(userId)
                _programsState.value = NetworkResult.Success(programs)
            } catch (e: Exception) {
                _programsState.value = NetworkResult.Error(e.message ?: "Failed to load programs")
            }
        }
    }

    private fun loadTemplates() {
        viewModelScope.launch {
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                _templates.value = templateRepository.getTemplates(userId)
            } catch (_: Exception) {}
        }
    }

    fun showCreateDialog() { _showCreateDialog.value = true }
    fun hideCreateDialog() { _showCreateDialog.value = false }

    fun createProgram(name: String, templateId: Int?) {
        viewModelScope.launch {
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                programRepository.createProgram(
                    userId,
                    CreateProgramRequest(
                        name = name,
                        template_id = templateId,
                        start_date = java.time.LocalDate.now().toString()
                    )
                )
                hideCreateDialog()
                loadPrograms()
            } catch (_: Exception) {}
        }
    }

    fun duplicateProgram(programId: Int) {
        viewModelScope.launch {
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                programRepository.duplicateProgram(userId, programId)
                loadPrograms()
            } catch (_: Exception) {}
        }
    }

    fun finishProgram(programId: Int) {
        viewModelScope.launch {
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                programRepository.finishProgram(userId, programId)
                loadPrograms()
            } catch (_: Exception) {}
        }
    }

    fun deleteProgram(programId: Int) {
        viewModelScope.launch {
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                programRepository.deleteProgram(userId, programId)
                loadPrograms()
            } catch (_: Exception) {}
        }
    }
}

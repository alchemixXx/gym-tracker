package com.gymtracker.app.ui.templates

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gymtracker.app.data.model.Template
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
class TemplatesViewModel @Inject constructor(
    private val templateRepository: TemplateRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _templatesState = MutableStateFlow<NetworkResult<List<Template>>>(NetworkResult.Loading)
    val templatesState: StateFlow<NetworkResult<List<Template>>> = _templatesState.asStateFlow()

    init {
        loadTemplates()
    }

    fun loadTemplates() {
        viewModelScope.launch {
            _templatesState.value = NetworkResult.Loading
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                val templates = templateRepository.getTemplates(userId)
                _templatesState.value = NetworkResult.Success(templates)
            } catch (e: Exception) {
                _templatesState.value = NetworkResult.Error(e.message ?: "Failed to load templates")
            }
        }
    }

    fun deleteTemplate(templateId: Int) {
        viewModelScope.launch {
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                templateRepository.deleteTemplate(userId, templateId)
                loadTemplates()
            } catch (e: Exception) {
                // Could show error
            }
        }
    }
}

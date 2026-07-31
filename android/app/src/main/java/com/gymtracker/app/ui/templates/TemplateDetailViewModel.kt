package com.gymtracker.app.ui.templates

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gymtracker.app.data.model.*
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

data class EditableSet(
    val weight: String = "",
    val reps: String = "",
    val count: String = "1"
)

data class EditableExercise(
    val name: String = "",
    val sets: List<EditableSet> = listOf(EditableSet())
)

data class EditableDay(
    val name: String = "",
    val exercises: List<EditableExercise> = listOf(EditableExercise())
)

@HiltViewModel
class TemplateDetailViewModel @Inject constructor(
    private val templateRepository: TemplateRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _loadState = MutableStateFlow<NetworkResult<Unit>>(NetworkResult.Success(Unit))
    val loadState: StateFlow<NetworkResult<Unit>> = _loadState.asStateFlow()

    private val _templateName = MutableStateFlow("")
    val templateName: StateFlow<String> = _templateName.asStateFlow()

    private val _days = MutableStateFlow<List<EditableDay>>(listOf(EditableDay()))
    val days: StateFlow<List<EditableDay>> = _days.asStateFlow()

    private val _saveState = MutableStateFlow<NetworkResult<Unit>?>(null)
    val saveState: StateFlow<NetworkResult<Unit>?> = _saveState.asStateFlow()

    private var templateId: Int? = null

    fun loadTemplate(id: Int?) {
        if (id == null) {
            // Creating new template
            templateId = null
            return
        }
        templateId = id
        viewModelScope.launch {
            _loadState.value = NetworkResult.Loading
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                val template = templateRepository.getTemplate(userId, id)
                _templateName.value = template.name
                _days.value = template.days?.map { day ->
                    EditableDay(
                        name = day.name,
                        exercises = day.exercises?.map { ex ->
                            EditableExercise(
                                name = ex.name,
                                sets = ex.sets?.map { set ->
                                    EditableSet(
                                        weight = set.weight?.toString() ?: "",
                                        reps = set.reps.toString(),
                                        count = set.count.toString()
                                    )
                                } ?: listOf(EditableSet())
                            )
                        } ?: listOf(EditableExercise())
                    )
                } ?: listOf(EditableDay())
                _loadState.value = NetworkResult.Success(Unit)
            } catch (e: Exception) {
                _loadState.value = NetworkResult.Error(e.message ?: "Failed to load template")
            }
        }
    }

    fun updateName(name: String) {
        _templateName.value = name
    }

    fun updateDayName(dayIndex: Int, name: String) {
        _days.value = _days.value.toMutableList().apply {
            this[dayIndex] = this[dayIndex].copy(name = name)
        }
    }

    fun updateExerciseName(dayIndex: Int, exerciseIndex: Int, name: String) {
        _days.value = _days.value.toMutableList().apply {
            val day = this[dayIndex]
            val exercises = day.exercises.toMutableList().apply {
                this[exerciseIndex] = this[exerciseIndex].copy(name = name)
            }
            this[dayIndex] = day.copy(exercises = exercises)
        }
    }

    fun updateSet(dayIndex: Int, exerciseIndex: Int, setIndex: Int, set: EditableSet) {
        _days.value = _days.value.toMutableList().apply {
            val day = this[dayIndex]
            val exercises = day.exercises.toMutableList().apply {
                val exercise = this[exerciseIndex]
                val sets = exercise.sets.toMutableList().apply {
                    this[setIndex] = set
                }
                this[exerciseIndex] = exercise.copy(sets = sets)
            }
            this[dayIndex] = day.copy(exercises = exercises)
        }
    }

    fun addDay() {
        _days.value = _days.value + EditableDay()
    }

    fun removeDay(dayIndex: Int) {
        if (_days.value.size > 1) {
            _days.value = _days.value.toMutableList().apply { removeAt(dayIndex) }
        }
    }

    fun addExercise(dayIndex: Int) {
        _days.value = _days.value.toMutableList().apply {
            val day = this[dayIndex]
            this[dayIndex] = day.copy(exercises = day.exercises + EditableExercise())
        }
    }

    fun removeExercise(dayIndex: Int, exerciseIndex: Int) {
        _days.value = _days.value.toMutableList().apply {
            val day = this[dayIndex]
            if (day.exercises.size > 1) {
                this[dayIndex] = day.copy(
                    exercises = day.exercises.toMutableList().apply { removeAt(exerciseIndex) }
                )
            }
        }
    }

    fun addSet(dayIndex: Int, exerciseIndex: Int) {
        _days.value = _days.value.toMutableList().apply {
            val day = this[dayIndex]
            val exercises = day.exercises.toMutableList().apply {
                val exercise = this[exerciseIndex]
                this[exerciseIndex] = exercise.copy(sets = exercise.sets + EditableSet())
            }
            this[dayIndex] = day.copy(exercises = exercises)
        }
    }

    fun removeSet(dayIndex: Int, exerciseIndex: Int, setIndex: Int) {
        _days.value = _days.value.toMutableList().apply {
            val day = this[dayIndex]
            val exercises = day.exercises.toMutableList().apply {
                val exercise = this[exerciseIndex]
                if (exercise.sets.size > 1) {
                    this[exerciseIndex] = exercise.copy(
                        sets = exercise.sets.toMutableList().apply { removeAt(setIndex) }
                    )
                }
            }
            this[dayIndex] = day.copy(exercises = exercises)
        }
    }

    fun save() {
        viewModelScope.launch {
            _saveState.value = NetworkResult.Loading
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                val request = CreateTemplateRequest(
                    name = _templateName.value.trim(),
                    days = _days.value.map { day ->
                        CreateTemplateDayRequest(
                            name = day.name.trim(),
                            exercises = day.exercises.map { ex ->
                                CreateTemplateExerciseRequest(
                                    name = ex.name.trim(),
                                    sets = ex.sets.map { set ->
                                        CreateTemplateSetRequest(
                                            weight = set.weight.toDoubleOrNull(),
                                            reps = set.reps.toIntOrNull() ?: 0,
                                            count = set.count.toIntOrNull() ?: 1
                                        )
                                    }
                                )
                            }
                        )
                    }
                )

                if (templateId != null) {
                    templateRepository.updateTemplate(userId, templateId!!, request)
                } else {
                    templateRepository.createTemplate(userId, request)
                }
                _saveState.value = NetworkResult.Success(Unit)
            } catch (e: Exception) {
                _saveState.value = NetworkResult.Error(e.message ?: "Failed to save template")
            }
        }
    }
}

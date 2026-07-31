package com.gymtracker.app.ui.programs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gymtracker.app.data.model.*
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

data class SessionState(
    val program: Program? = null,
    val day: ProgramDay? = null,
    val exerciseHistories: Map<String, List<ExerciseHistory>> = emptyMap(),
    val dayHistory: List<DayHistory> = emptyList()
)

@HiltViewModel
class GymSessionViewModel @Inject constructor(
    private val programRepository: ProgramRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _loadState = MutableStateFlow<NetworkResult<SessionState>>(NetworkResult.Loading)
    val loadState: StateFlow<NetworkResult<SessionState>> = _loadState.asStateFlow()

    private val _sessionState = MutableStateFlow(SessionState())
    val sessionState: StateFlow<SessionState> = _sessionState.asStateFlow()

    private var userId: Int = 0
    private var programId: Int = 0
    private var dayId: Int = 0

    fun loadSession(programId: Int, dayId: Int) {
        this.programId = programId
        this.dayId = dayId

        viewModelScope.launch {
            _loadState.value = NetworkResult.Loading
            try {
                userId = userRepository.selectedUserId.first() ?: return@launch
                val program = programRepository.getProgram(userId, programId)
                val day = program.days?.find { it.id == dayId }

                if (day == null) {
                    _loadState.value = NetworkResult.Error("Day not found")
                    return@launch
                }

                _sessionState.value = SessionState(program = program, day = day)

                // Load histories in background
                loadHistories(program, day)

                _loadState.value = NetworkResult.Success(_sessionState.value)
            } catch (e: Exception) {
                _loadState.value = NetworkResult.Error(e.message ?: "Failed to load session")
            }
        }
    }

    private fun loadHistories(program: Program, day: ProgramDay) {
        viewModelScope.launch {
            try {
                val dayHistory = programRepository.getDayHistory(userId, program.id, day.name)
                _sessionState.value = _sessionState.value.copy(dayHistory = dayHistory)

                val histories = mutableMapOf<String, List<ExerciseHistory>>()
                day.exercises?.forEach { exercise ->
                    try {
                        val history = programRepository.getExerciseHistory(
                            userId, program.id, day.name, exercise.name
                        )
                        histories[exercise.name] = history
                    } catch (_: Exception) {}
                }
                _sessionState.value = _sessionState.value.copy(exerciseHistories = histories)
            } catch (_: Exception) {}
        }
    }

    fun toggleSet(exerciseId: Int, setId: Int, currentDone: Boolean) {
        viewModelScope.launch {
            try {
                programRepository.updateSet(
                    userId, programId, dayId, exerciseId, setId,
                    UpdateSetRequest(done = !currentDone)
                )
                // Update local state
                updateSetLocally(exerciseId, setId) { it.copy(done = !currentDone) }
            } catch (_: Exception) {}
        }
    }

    fun updateSetWeight(exerciseId: Int, setId: Int, weight: Double?) {
        viewModelScope.launch {
            try {
                programRepository.updateSet(
                    userId, programId, dayId, exerciseId, setId,
                    UpdateSetRequest(weight = weight)
                )
                updateSetLocally(exerciseId, setId) { it.copy(weight = weight) }
            } catch (_: Exception) {}
        }
    }

    fun updateSetReps(exerciseId: Int, setId: Int, reps: Int) {
        viewModelScope.launch {
            try {
                programRepository.updateSet(
                    userId, programId, dayId, exerciseId, setId,
                    UpdateSetRequest(reps = reps)
                )
                updateSetLocally(exerciseId, setId) { it.copy(reps = reps) }
            } catch (_: Exception) {}
        }
    }

    fun updateExerciseNote(exerciseId: Int, note: String) {
        viewModelScope.launch {
            try {
                programRepository.updateExercise(
                    userId, programId, dayId, exerciseId,
                    UpdateExerciseRequest(note = note)
                )
                // Update local state
                val currentDay = _sessionState.value.day ?: return@launch
                val updatedExercises = currentDay.exercises?.map { ex ->
                    if (ex.id == exerciseId) ex.copy(note = note) else ex
                }
                _sessionState.value = _sessionState.value.copy(
                    day = currentDay.copy(exercises = updatedExercises)
                )
            } catch (_: Exception) {}
        }
    }

    fun updateDayNote(note: String) {
        viewModelScope.launch {
            try {
                programRepository.updateDay(
                    userId, programId, dayId,
                    UpdateDayRequest(day_note = note)
                )
                val currentDay = _sessionState.value.day ?: return@launch
                _sessionState.value = _sessionState.value.copy(
                    day = currentDay.copy(day_note = note)
                )
            } catch (_: Exception) {}
        }
    }

    fun completeDay() {
        viewModelScope.launch {
            try {
                val now = java.time.Instant.now().toString()
                programRepository.updateDay(
                    userId, programId, dayId,
                    UpdateDayRequest(completed_at = now)
                )
                val currentDay = _sessionState.value.day ?: return@launch
                _sessionState.value = _sessionState.value.copy(
                    day = currentDay.copy(completed_at = now)
                )
            } catch (_: Exception) {}
        }
    }

    private fun updateSetLocally(exerciseId: Int, setId: Int, transform: (ProgramSet) -> ProgramSet) {
        val currentDay = _sessionState.value.day ?: return
        val updatedExercises = currentDay.exercises?.map { ex ->
            if (ex.id == exerciseId) {
                ex.copy(sets = ex.sets?.map { set ->
                    if (set.id == setId) transform(set) else set
                })
            } else ex
        }
        _sessionState.value = _sessionState.value.copy(
            day = currentDay.copy(exercises = updatedExercises)
        )
    }
}

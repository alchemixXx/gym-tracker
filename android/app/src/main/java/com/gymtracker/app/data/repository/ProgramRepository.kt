package com.gymtracker.app.data.repository

import com.gymtracker.app.data.api.GymTrackerApi
import com.gymtracker.app.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProgramRepository @Inject constructor(
    private val api: GymTrackerApi
) {
    suspend fun getPrograms(userId: Int): List<Program> =
        api.getPrograms(userId)

    suspend fun getProgram(userId: Int, id: Int): Program =
        api.getProgram(userId, id)

    suspend fun createProgram(userId: Int, request: CreateProgramRequest): Program =
        api.createProgram(userId, request)

    suspend fun updateProgram(userId: Int, id: Int, request: UpdateProgramRequest): Program =
        api.updateProgram(userId, id, request)

    suspend fun duplicateProgram(userId: Int, id: Int, name: String? = null): Program =
        api.duplicateProgram(userId, id, DuplicateProgramRequest(name))

    suspend fun finishProgram(userId: Int, id: Int): Program =
        api.finishProgram(userId, id)

    suspend fun deleteProgram(userId: Int, id: Int) =
        api.deleteProgram(userId, id)

    // Session actions
    suspend fun updateDay(userId: Int, programId: Int, dayId: Int, request: UpdateDayRequest): ProgramDay =
        api.updateDay(userId, programId, dayId, request)

    suspend fun updateExercise(userId: Int, programId: Int, dayId: Int, exId: Int, request: UpdateExerciseRequest): ProgramExercise =
        api.updateExercise(userId, programId, dayId, exId, request)

    suspend fun updateSet(userId: Int, programId: Int, dayId: Int, exId: Int, setId: Int, request: UpdateSetRequest): ProgramSet =
        api.updateSet(userId, programId, dayId, exId, setId, request)

    // History
    suspend fun getExerciseHistory(userId: Int, programId: Int, dayName: String, exerciseName: String): List<ExerciseHistory> =
        api.getExerciseHistory(userId, programId, dayName, exerciseName)

    suspend fun getDayHistory(userId: Int, programId: Int, dayName: String): List<DayHistory> =
        api.getDayHistory(userId, programId, dayName)
}

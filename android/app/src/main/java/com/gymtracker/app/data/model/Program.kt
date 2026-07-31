package com.gymtracker.app.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Program(
    val id: Int,
    val user_id: Int,
    val name: String,
    val template_id: Int? = null,
    val start_date: String? = null,
    val status: String = "active",
    val created_at: String? = null,
    val updated_at: String? = null,
    val days: List<ProgramDay>? = null
)

@Serializable
data class ProgramDay(
    val id: Int,
    val program_id: Int? = null,
    val name: String,
    val sort_order: Int,
    val day_note: String? = null,
    val completed_at: String? = null,
    val exercises: List<ProgramExercise>? = null
)

@Serializable
data class ProgramExercise(
    val id: Int,
    val program_day_id: Int? = null,
    val name: String,
    val sort_order: Int,
    val note: String? = null,
    val sets: List<ProgramSet>? = null
)

@Serializable
data class ProgramSet(
    val id: Int,
    val program_exercise_id: Int? = null,
    val weight: Double? = null,
    val reps: Int,
    val count: Int = 1,
    val done: Boolean = false,
    val sort_order: Int
)

// Request bodies
@Serializable
data class CreateProgramRequest(
    val name: String,
    val start_date: String? = null,
    val template_id: Int? = null,
    val days: List<CreateProgramDayRequest>? = null
)

@Serializable
data class CreateProgramDayRequest(
    val name: String,
    val exercises: List<CreateProgramExerciseRequest>? = null
)

@Serializable
data class CreateProgramExerciseRequest(
    val name: String,
    val sets: List<CreateProgramSetRequest>? = null
)

@Serializable
data class CreateProgramSetRequest(
    val weight: Double? = null,
    val reps: Int,
    val count: Int = 1
)

@Serializable
data class UpdateProgramRequest(
    val name: String? = null,
    val start_date: String? = null,
    val days: List<CreateProgramDayRequest>? = null
)

@Serializable
data class UpdateDayRequest(
    val day_note: String? = null,
    val completed_at: String? = null
)

@Serializable
data class UpdateExerciseRequest(
    val note: String? = null
)

@Serializable
data class UpdateSetRequest(
    val done: Boolean? = null,
    val weight: Double? = null,
    val reps: Int? = null,
    val count: Int? = null
)

@Serializable
data class DuplicateProgramRequest(
    val name: String? = null
)

@Serializable
data class ExerciseHistory(
    val exercise_note: String? = null,
    val day_note: String? = null,
    val completed_at: String? = null,
    val program_name: String? = null
)

@Serializable
data class DayHistory(
    val day_note: String? = null,
    val completed_at: String? = null,
    val program_name: String? = null
)

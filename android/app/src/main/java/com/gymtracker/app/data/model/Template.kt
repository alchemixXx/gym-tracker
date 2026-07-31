package com.gymtracker.app.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Template(
    val id: Int,
    val user_id: Int,
    val name: String,
    val created_at: String? = null,
    val updated_at: String? = null,
    val days: List<TemplateDay>? = null
)

@Serializable
data class TemplateDay(
    val id: Int,
    val template_id: Int? = null,
    val name: String,
    val sort_order: Int,
    val exercises: List<TemplateExercise>? = null
)

@Serializable
data class TemplateExercise(
    val id: Int,
    val template_day_id: Int? = null,
    val name: String,
    val sort_order: Int,
    val sets: List<TemplateSet>? = null
)

@Serializable
data class TemplateSet(
    val id: Int,
    val template_exercise_id: Int? = null,
    val weight: Double? = null,
    val reps: Int,
    val count: Int = 1,
    val sort_order: Int
)

// Request bodies for creating/updating templates
@Serializable
data class CreateTemplateRequest(
    val name: String,
    val days: List<CreateTemplateDayRequest>? = null
)

@Serializable
data class CreateTemplateDayRequest(
    val name: String,
    val exercises: List<CreateTemplateExerciseRequest>? = null
)

@Serializable
data class CreateTemplateExerciseRequest(
    val name: String,
    val sets: List<CreateTemplateSetRequest>? = null
)

@Serializable
data class CreateTemplateSetRequest(
    val weight: Double? = null,
    val reps: Int,
    val count: Int = 1
)

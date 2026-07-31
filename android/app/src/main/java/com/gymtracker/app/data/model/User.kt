package com.gymtracker.app.data.model

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: Int,
    val name: String,
    val created_at: String? = null
)

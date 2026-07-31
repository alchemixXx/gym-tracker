package com.gymtracker.app.data.repository

import com.gymtracker.app.data.api.GymTrackerApi
import com.gymtracker.app.data.model.CreateTemplateRequest
import com.gymtracker.app.data.model.Template
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TemplateRepository @Inject constructor(
    private val api: GymTrackerApi
) {
    suspend fun getTemplates(userId: Int): List<Template> =
        api.getTemplates(userId)

    suspend fun getTemplate(userId: Int, id: Int): Template =
        api.getTemplate(userId, id)

    suspend fun createTemplate(userId: Int, request: CreateTemplateRequest): Template =
        api.createTemplate(userId, request)

    suspend fun updateTemplate(userId: Int, id: Int, request: CreateTemplateRequest): Template =
        api.updateTemplate(userId, id, request)

    suspend fun deleteTemplate(userId: Int, id: Int) =
        api.deleteTemplate(userId, id)
}

package com.gymtracker.app.ui.measurements

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gymtracker.app.data.model.CreateMeasurementEntryRequest
import com.gymtracker.app.data.model.CreateMeasurementRequest
import com.gymtracker.app.data.model.Measurement
import com.gymtracker.app.data.repository.MeasurementRepository
import com.gymtracker.app.data.repository.UserRepository
import com.gymtracker.app.util.NetworkResult
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NewMeasurementEntry(
    val type: String = "",
    val value: String = ""
)

@HiltViewModel
class MeasurementsViewModel @Inject constructor(
    private val measurementRepository: MeasurementRepository,
    private val userRepository: UserRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _measurementsState = MutableStateFlow<NetworkResult<List<Measurement>>>(NetworkResult.Loading)
    val measurementsState: StateFlow<NetworkResult<List<Measurement>>> = _measurementsState.asStateFlow()

    private val _showAddDialog = MutableStateFlow(false)
    val showAddDialog: StateFlow<Boolean> = _showAddDialog.asStateFlow()

    private val _uploading = MutableStateFlow(false)
    val uploading: StateFlow<Boolean> = _uploading.asStateFlow()

    init {
        loadMeasurements()
    }

    fun loadMeasurements() {
        viewModelScope.launch {
            _measurementsState.value = NetworkResult.Loading
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                val measurements = measurementRepository.getMeasurements(userId)
                _measurementsState.value = NetworkResult.Success(measurements)
            } catch (e: Exception) {
                _measurementsState.value = NetworkResult.Error(e.message ?: "Failed to load measurements")
            }
        }
    }

    fun showAddDialog() { _showAddDialog.value = true }
    fun hideAddDialog() { _showAddDialog.value = false }

    fun createMeasurement(
        date: String?,
        weight: String?,
        notes: String?,
        entries: List<NewMeasurementEntry>
    ) {
        viewModelScope.launch {
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                val request = CreateMeasurementRequest(
                    date = date,
                    weight = weight?.toDoubleOrNull(),
                    notes = notes?.takeIf { it.isNotBlank() },
                    entries = entries
                        .filter { it.type.isNotBlank() && it.value.isNotBlank() }
                        .map { CreateMeasurementEntryRequest(type = it.type, value = it.value.toDoubleOrNull() ?: 0.0) }
                )
                measurementRepository.createMeasurement(userId, request)
                hideAddDialog()
                loadMeasurements()
            } catch (_: Exception) {}
        }
    }

    fun deleteMeasurement(id: Int) {
        viewModelScope.launch {
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                measurementRepository.deleteMeasurement(userId, id)
                loadMeasurements()
            } catch (_: Exception) {}
        }
    }

    fun uploadPhotos(measurementId: Int, uris: List<Uri>) {
        viewModelScope.launch {
            _uploading.value = true
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                val photos = uris.mapNotNull { uri ->
                    try {
                        val inputStream = context.contentResolver.openInputStream(uri) ?: return@mapNotNull null
                        val bytes = inputStream.readBytes()
                        inputStream.close()
                        val filename = uri.lastPathSegment ?: "photo.jpg"
                        filename to bytes
                    } catch (_: Exception) { null }
                }
                if (photos.isNotEmpty()) {
                    measurementRepository.uploadPhotos(userId, measurementId, photos)
                    loadMeasurements()
                }
            } catch (_: Exception) {}
            _uploading.value = false
        }
    }

    fun deletePhoto(measurementId: Int, photoId: Int) {
        viewModelScope.launch {
            try {
                val userId = userRepository.selectedUserId.first() ?: return@launch
                measurementRepository.deletePhoto(userId, measurementId, photoId)
                loadMeasurements()
            } catch (_: Exception) {}
        }
    }

    fun getPhotoUrl(photoId: Int): String {
        val baseUrl = com.gymtracker.app.BuildConfig.API_BASE_URL.removeSuffix("/").removeSuffix("/api")
        return "${baseUrl}photos/$photoId/image"
    }
}

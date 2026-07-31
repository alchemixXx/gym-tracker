package com.gymtracker.app.ui.measurements

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.gymtracker.app.data.model.Measurement
import com.gymtracker.app.data.model.PhotoMeta
import com.gymtracker.app.util.NetworkResult

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MeasurementsScreen(
    onBack: () -> Unit,
    viewModel: MeasurementsViewModel = hiltViewModel()
) {
    val measurementsState by viewModel.measurementsState.collectAsState()
    val showAddDialog by viewModel.showAddDialog.collectAsState()
    val uploading by viewModel.uploading.collectAsState()
    var measurementToDelete by remember { mutableStateOf<Measurement?>(null) }
    var expandedMeasurement by remember { mutableStateOf<Int?>(null) }

    // Photo picker
    var photoTargetMeasurement by remember { mutableStateOf<Int?>(null) }
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        photoTargetMeasurement?.let { measurementId ->
            viewModel.uploadPhotos(measurementId, uris)
        }
        photoTargetMeasurement = null
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Measurements") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { viewModel.showAddDialog() }) {
                Icon(Icons.Default.Add, "Add measurement")
            }
        }
    ) { padding ->
        when (val state = measurementsState) {
            is NetworkResult.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentAlignment = Alignment.Center
                ) { CircularProgressIndicator() }
            }

            is NetworkResult.Error -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(state.message, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { viewModel.loadMeasurements() }) { Text("Retry") }
                }
            }

            is NetworkResult.Success -> {
                if (state.data.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            "No measurements yet.\nTrack your progress!",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(state.data) { measurement ->
                            MeasurementCard(
                                measurement = measurement,
                                isExpanded = expandedMeasurement == measurement.id,
                                uploading = uploading,
                                onToggleExpand = {
                                    expandedMeasurement = if (expandedMeasurement == measurement.id) null else measurement.id
                                },
                                onDelete = { measurementToDelete = measurement },
                                onAddPhotos = {
                                    photoTargetMeasurement = measurement.id
                                    photoPickerLauncher.launch("image/*")
                                },
                                onDeletePhoto = { photoId -> viewModel.deletePhoto(measurement.id, photoId) },
                                getPhotoUrl = { viewModel.getPhotoUrl(it) }
                            )
                        }
                    }
                }
            }
        }
    }

    // Add measurement dialog
    if (showAddDialog) {
        AddMeasurementDialog(
            onDismiss = { viewModel.hideAddDialog() },
            onConfirm = { date, weight, notes, entries ->
                viewModel.createMeasurement(date, weight, notes, entries)
            }
        )
    }

    // Delete confirmation
    measurementToDelete?.let { measurement ->
        AlertDialog(
            onDismissRequest = { measurementToDelete = null },
            title = { Text("Delete Measurement") },
            text = { Text("Delete measurement from ${measurement.date}?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteMeasurement(measurement.id)
                        measurementToDelete = null
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { measurementToDelete = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun MeasurementCard(
    measurement: Measurement,
    isExpanded: Boolean,
    uploading: Boolean,
    onToggleExpand: () -> Unit,
    onDelete: () -> Unit,
    onAddPhotos: () -> Unit,
    onDeletePhoto: (Int) -> Unit,
    getPhotoUrl: (Int) -> String
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onToggleExpand
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(measurement.date, style = MaterialTheme.typography.titleMedium)
                    measurement.weight?.let {
                        Text("${it} kg", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
                    }
                }
                val photoCount = measurement.photos?.size ?: 0
                if (photoCount > 0) {
                    Badge { Text("$photoCount") }
                    Spacer(modifier = Modifier.width(8.dp))
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, "Delete", tint = MaterialTheme.colorScheme.error)
                }
            }

            if (isExpanded) {
                Spacer(modifier = Modifier.height(8.dp))

                // Entries
                val entries = measurement.entries ?: emptyList()
                if (entries.isNotEmpty()) {
                    entries.forEach { entry ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(entry.type, style = MaterialTheme.typography.bodyMedium)
                            Text("${entry.value} cm", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }

                // Notes
                measurement.notes?.takeIf { it.isNotBlank() }?.let { notes ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(notes, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }

                // Photos
                val photos = measurement.photos ?: emptyList()
                if (photos.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(photos) { photo ->
                            PhotoThumbnail(
                                photo = photo,
                                url = getPhotoUrl(photo.id),
                                onDelete = { onDeletePhoto(photo.id) }
                            )
                        }
                    }
                }

                // Add photos button
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = onAddPhotos, enabled = !uploading) {
                        Icon(Icons.Default.AddAPhoto, null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(if (uploading) "Uploading..." else "Add Photos")
                    }
                    if (uploading) {
                        Spacer(modifier = Modifier.width(8.dp))
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    }
                }
            }
        }
    }
}

@Composable
private fun PhotoThumbnail(
    photo: PhotoMeta,
    url: String,
    onDelete: () -> Unit
) {
    Box {
        Card(modifier = Modifier.size(80.dp)) {
            AsyncImage(
                model = url,
                contentDescription = photo.original_name,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        }
        IconButton(
            onClick = onDelete,
            modifier = Modifier.align(Alignment.TopEnd).size(24.dp)
        ) {
            Icon(
                Icons.Default.Close, "Delete photo",
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.error
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddMeasurementDialog(
    onDismiss: () -> Unit,
    onConfirm: (String?, String?, String?, List<NewMeasurementEntry>) -> Unit
) {
    var weight by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var entries by remember { mutableStateOf(listOf(NewMeasurementEntry())) }

    val measurementTypes = listOf("Bicep", "Chest", "Waist", "Hips", "Thigh", "Calf", "Shoulders", "Forearm")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Measurement") },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 400.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = weight,
                    onValueChange = { weight = it },
                    label = { Text("Body Weight (kg)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth()
                )

                Text("Body Measurements", style = MaterialTheme.typography.labelMedium)

                entries.forEachIndexed { index, entry ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        var typeExpanded by remember { mutableStateOf(false) }
                        ExposedDropdownMenuBox(
                            expanded = typeExpanded,
                            onExpandedChange = { typeExpanded = it },
                            modifier = Modifier.weight(1f)
                        ) {
                            OutlinedTextField(
                                value = entry.type,
                                onValueChange = {
                                    entries = entries.toMutableList().apply {
                                        this[index] = this[index].copy(type = it)
                                    }
                                },
                                label = { Text("Type") },
                                singleLine = true,
                                modifier = Modifier.menuAnchor()
                            )
                            ExposedDropdownMenu(expanded = typeExpanded, onDismissRequest = { typeExpanded = false }) {
                                measurementTypes.forEach { type ->
                                    DropdownMenuItem(
                                        text = { Text(type) },
                                        onClick = {
                                            entries = entries.toMutableList().apply {
                                                this[index] = this[index].copy(type = type)
                                            }
                                            typeExpanded = false
                                        }
                                    )
                                }
                            }
                        }

                        OutlinedTextField(
                            value = entry.value,
                            onValueChange = {
                                entries = entries.toMutableList().apply {
                                    this[index] = this[index].copy(value = it)
                                }
                            },
                            label = { Text("cm") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.width(72.dp)
                        )

                        if (entries.size > 1) {
                            IconButton(
                                onClick = { entries = entries.toMutableList().apply { removeAt(index) } },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(Icons.Default.Close, "Remove", modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }

                TextButton(onClick = { entries = entries + NewMeasurementEntry() }) {
                    Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Entry")
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onConfirm(null, weight.takeIf { it.isNotBlank() }, notes, entries)
            }) { Text("Save") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

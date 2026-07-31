package com.gymtracker.app.ui.programs

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gymtracker.app.data.model.ExerciseHistory
import com.gymtracker.app.data.model.ProgramExercise
import com.gymtracker.app.data.model.ProgramSet
import com.gymtracker.app.util.NetworkResult

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GymSessionScreen(
    programId: Int,
    dayId: Int,
    onBack: () -> Unit,
    viewModel: GymSessionViewModel = hiltViewModel()
) {
    val loadState by viewModel.loadState.collectAsState()
    val sessionState by viewModel.sessionState.collectAsState()
    var showDayNoteDialog by remember { mutableStateOf(false) }
    var showCompleteDialog by remember { mutableStateOf(false) }
    var showHistoryFor by remember { mutableStateOf<String?>(null) }

    // Keep screen on during workout
    val view = LocalView.current
    DisposableEffect(Unit) {
        view.keepScreenOn = true
        onDispose { view.keepScreenOn = false }
    }

    LaunchedEffect(programId, dayId) {
        viewModel.loadSession(programId, dayId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(sessionState.day?.name ?: "Session") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    if (sessionState.day?.completed_at == null) {
                        IconButton(onClick = { showDayNoteDialog = true }) {
                            Icon(Icons.Default.NoteAlt, "Day note")
                        }
                        IconButton(onClick = { showCompleteDialog = true }) {
                            Icon(Icons.Default.Done, "Complete day")
                        }
                    }
                }
            )
        }
    ) { padding ->
        when (loadState) {
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
                    Text(
                        (loadState as NetworkResult.Error).message,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { viewModel.loadSession(programId, dayId) }) { Text("Retry") }
                }
            }

            is NetworkResult.Success -> {
                val day = sessionState.day ?: return@Scaffold
                val isCompleted = day.completed_at != null

                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Completed banner
                    if (isCompleted) {
                        item {
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.primaryContainer
                                )
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.CheckCircle, null, tint = MaterialTheme.colorScheme.primary)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Day completed", style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                    }

                    // Day note display
                    day.day_note?.takeIf { it.isNotBlank() }?.let { note ->
                        item {
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.5f)
                                )
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text("Day Note", style = MaterialTheme.typography.labelSmall)
                                    Text(note, style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                    }

                    // Exercises
                    val exercises = day.exercises ?: emptyList()
                    items(exercises) { exercise ->
                        ExerciseCard(
                            exercise = exercise,
                            isSessionCompleted = isCompleted,
                            history = sessionState.exerciseHistories[exercise.name],
                            onToggleSet = { setId, done -> viewModel.toggleSet(exercise.id, setId, done) },
                            onUpdateWeight = { setId, weight -> viewModel.updateSetWeight(exercise.id, setId, weight) },
                            onUpdateReps = { setId, reps -> viewModel.updateSetReps(exercise.id, setId, reps) },
                            onUpdateNote = { note -> viewModel.updateExerciseNote(exercise.id, note) },
                            onShowHistory = { showHistoryFor = exercise.name }
                        )
                    }
                }
            }
        }
    }

    // Day note dialog
    if (showDayNoteDialog) {
        var note by remember { mutableStateOf(sessionState.day?.day_note ?: "") }
        AlertDialog(
            onDismissRequest = { showDayNoteDialog = false },
            title = { Text("Day Note") },
            text = {
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Note for today's session") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.updateDayNote(note)
                    showDayNoteDialog = false
                }) { Text("Save") }
            },
            dismissButton = {
                TextButton(onClick = { showDayNoteDialog = false }) { Text("Cancel") }
            }
        )
    }

    // Complete day dialog
    if (showCompleteDialog) {
        AlertDialog(
            onDismissRequest = { showCompleteDialog = false },
            title = { Text("Complete Day") },
            text = { Text("Mark this training day as completed?") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.completeDay()
                    showCompleteDialog = false
                }) { Text("Complete") }
            },
            dismissButton = {
                TextButton(onClick = { showCompleteDialog = false }) { Text("Cancel") }
            }
        )
    }

    // Exercise history bottom sheet
    showHistoryFor?.let { exerciseName ->
        val history = sessionState.exerciseHistories[exerciseName] ?: emptyList()
        AlertDialog(
            onDismissRequest = { showHistoryFor = null },
            title = { Text("History: $exerciseName") },
            text = {
                if (history.isEmpty()) {
                    Text("No previous notes for this exercise.")
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        history.forEach { h ->
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                                )
                            ) {
                                Column(modifier = Modifier.padding(8.dp)) {
                                    h.program_name?.let {
                                        Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                                    }
                                    h.exercise_note?.let {
                                        Text(it, style = MaterialTheme.typography.bodyMedium)
                                    }
                                    h.completed_at?.let {
                                        Text(it.take(10), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showHistoryFor = null }) { Text("Close") }
            }
        )
    }
}

@Composable
private fun ExerciseCard(
    exercise: ProgramExercise,
    isSessionCompleted: Boolean,
    history: List<ExerciseHistory>?,
    onToggleSet: (Int, Boolean) -> Unit,
    onUpdateWeight: (Int, Double?) -> Unit,
    onUpdateReps: (Int, Int) -> Unit,
    onUpdateNote: (String) -> Unit,
    onShowHistory: () -> Unit
) {
    var showNoteField by remember { mutableStateOf(false) }
    var noteText by remember(exercise.note) { mutableStateOf(exercise.note ?: "") }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Exercise header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    exercise.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                if (!history.isNullOrEmpty()) {
                    IconButton(onClick = onShowHistory, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.History, "History", modifier = Modifier.size(20.dp))
                    }
                }
                IconButton(
                    onClick = { showNoteField = !showNoteField },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.NoteAlt, "Note",
                        modifier = Modifier.size(20.dp),
                        tint = if (exercise.note?.isNotBlank() == true)
                            MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Note field
            if (showNoteField) {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = noteText,
                    onValueChange = { noteText = it },
                    label = { Text("Note") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = false,
                    minLines = 2,
                    enabled = !isSessionCompleted,
                    trailingIcon = {
                        if (noteText != (exercise.note ?: "")) {
                            IconButton(onClick = { onUpdateNote(noteText) }) {
                                Icon(Icons.Default.Save, "Save note")
                            }
                        }
                    }
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Sets header
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
            ) {
                Spacer(modifier = Modifier.width(40.dp)) // checkbox space
                Text("Weight", style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
                Text("Reps", style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
                Text("×", style = MaterialTheme.typography.labelSmall, modifier = Modifier.width(32.dp))
            }

            // Sets
            val sets = exercise.sets ?: emptyList()
            sets.forEach { set ->
                SetRow(
                    set = set,
                    enabled = !isSessionCompleted,
                    onToggle = { onToggleSet(set.id, set.done) },
                    onWeightChange = { onUpdateWeight(set.id, it) },
                    onRepsChange = { onUpdateReps(set.id, it) }
                )
            }
        }
    }
}

@Composable
private fun SetRow(
    set: ProgramSet,
    enabled: Boolean,
    onToggle: () -> Unit,
    onWeightChange: (Double?) -> Unit,
    onRepsChange: (Int) -> Unit
) {
    var weightText by remember(set.weight) { mutableStateOf(set.weight?.let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() } ?: "") }
    var repsText by remember(set.reps) { mutableStateOf(set.reps.toString()) }

    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = set.done,
            onCheckedChange = { if (enabled) onToggle() },
            modifier = Modifier.size(40.dp),
            enabled = enabled
        )

        OutlinedTextField(
            value = weightText,
            onValueChange = {
                weightText = it
                it.toDoubleOrNull()?.let { w -> onWeightChange(w) }
                if (it.isBlank()) onWeightChange(null)
            },
            modifier = Modifier.weight(1f).height(48.dp),
            singleLine = true,
            enabled = enabled,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            textStyle = MaterialTheme.typography.bodyLarge.copy(
                fontWeight = if (set.done) FontWeight.Bold else FontWeight.Normal
            )
        )

        Spacer(modifier = Modifier.width(4.dp))

        OutlinedTextField(
            value = repsText,
            onValueChange = {
                repsText = it
                it.toIntOrNull()?.let { r -> onRepsChange(r) }
            },
            modifier = Modifier.weight(1f).height(48.dp),
            singleLine = true,
            enabled = enabled,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            textStyle = MaterialTheme.typography.bodyLarge.copy(
                fontWeight = if (set.done) FontWeight.Bold else FontWeight.Normal
            )
        )

        Spacer(modifier = Modifier.width(4.dp))

        Text(
            "×${set.count}",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.width(32.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

package com.gymtracker.app.ui.templates

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gymtracker.app.util.NetworkResult

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TemplateDetailScreen(
    templateId: Int?,
    onBack: () -> Unit,
    viewModel: TemplateDetailViewModel = hiltViewModel()
) {
    val loadState by viewModel.loadState.collectAsState()
    val templateName by viewModel.templateName.collectAsState()
    val days by viewModel.days.collectAsState()
    val saveState by viewModel.saveState.collectAsState()

    LaunchedEffect(templateId) {
        viewModel.loadTemplate(templateId)
    }

    // Navigate back on successful save
    LaunchedEffect(saveState) {
        if (saveState is NetworkResult.Success) {
            onBack()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (templateId == null) "New Template" else "Edit Template") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(
                        onClick = { viewModel.save() },
                        enabled = templateName.isNotBlank() && saveState !is NetworkResult.Loading
                    ) {
                        Icon(Icons.Default.Save, "Save")
                    }
                }
            )
        }
    ) { padding ->
        when (loadState) {
            is NetworkResult.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is NetworkResult.Error -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = (loadState as NetworkResult.Error).message,
                        color = MaterialTheme.colorScheme.error
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { viewModel.loadTemplate(templateId) }) {
                        Text("Retry")
                    }
                }
            }

            is NetworkResult.Success -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Template name
                    item {
                        OutlinedTextField(
                            value = templateName,
                            onValueChange = { viewModel.updateName(it) },
                            label = { Text("Template Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    // Days
                    itemsIndexed(days) { dayIndex, day ->
                        DayCard(
                            dayIndex = dayIndex,
                            day = day,
                            canRemove = days.size > 1,
                            onDayNameChange = { viewModel.updateDayName(dayIndex, it) },
                            onExerciseNameChange = { exIdx, name ->
                                viewModel.updateExerciseName(dayIndex, exIdx, name)
                            },
                            onSetChange = { exIdx, setIdx, set ->
                                viewModel.updateSet(dayIndex, exIdx, setIdx, set)
                            },
                            onAddExercise = { viewModel.addExercise(dayIndex) },
                            onRemoveExercise = { viewModel.removeExercise(dayIndex, it) },
                            onAddSet = { viewModel.addSet(dayIndex, it) },
                            onRemoveSet = { exIdx, setIdx ->
                                viewModel.removeSet(dayIndex, exIdx, setIdx)
                            },
                            onRemoveDay = { viewModel.removeDay(dayIndex) }
                        )
                    }

                    // Add day button
                    item {
                        OutlinedButton(
                            onClick = { viewModel.addDay() },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Add, null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Add Day")
                        }
                    }

                    // Save error
                    if (saveState is NetworkResult.Error) {
                        item {
                            Text(
                                text = (saveState as NetworkResult.Error).message,
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DayCard(
    dayIndex: Int,
    day: EditableDay,
    canRemove: Boolean,
    onDayNameChange: (String) -> Unit,
    onExerciseNameChange: (Int, String) -> Unit,
    onSetChange: (Int, Int, EditableSet) -> Unit,
    onAddExercise: () -> Unit,
    onRemoveExercise: (Int) -> Unit,
    onAddSet: (Int) -> Unit,
    onRemoveSet: (Int, Int) -> Unit,
    onRemoveDay: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Day header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Day ${dayIndex + 1}",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.weight(1f))
                if (canRemove) {
                    IconButton(onClick = onRemoveDay, modifier = Modifier.size(32.dp)) {
                        Icon(
                            Icons.Default.Close, "Remove day",
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            OutlinedTextField(
                value = day.name,
                onValueChange = onDayNameChange,
                label = { Text("Day Name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Exercises
            day.exercises.forEachIndexed { exIndex, exercise ->
                ExerciseSection(
                    exerciseIndex = exIndex,
                    exercise = exercise,
                    canRemove = day.exercises.size > 1,
                    onNameChange = { onExerciseNameChange(exIndex, it) },
                    onSetChange = { setIdx, set -> onSetChange(exIndex, setIdx, set) },
                    onAddSet = { onAddSet(exIndex) },
                    onRemoveSet = { onRemoveSet(exIndex, it) },
                    onRemove = { onRemoveExercise(exIndex) }
                )
                if (exIndex < day.exercises.size - 1) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            TextButton(onClick = onAddExercise) {
                Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Exercise")
            }
        }
    }
}

@Composable
private fun ExerciseSection(
    exerciseIndex: Int,
    exercise: EditableExercise,
    canRemove: Boolean,
    onNameChange: (String) -> Unit,
    onSetChange: (Int, EditableSet) -> Unit,
    onAddSet: () -> Unit,
    onRemoveSet: (Int) -> Unit,
    onRemove: () -> Unit
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = exercise.name,
                onValueChange = onNameChange,
                label = { Text("Exercise ${exerciseIndex + 1}") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
            if (canRemove) {
                IconButton(onClick = onRemove, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Default.Close, "Remove",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Sets header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp),
        ) {
            Text("Weight", style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
            Text("Reps", style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
            Text("Sets", style = MaterialTheme.typography.labelSmall, modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.width(32.dp))
        }

        exercise.sets.forEachIndexed { setIndex, set ->
            SetRow(
                set = set,
                canRemove = exercise.sets.size > 1,
                onChange = { onSetChange(setIndex, it) },
                onRemove = { onRemoveSet(setIndex) }
            )
        }

        TextButton(onClick = onAddSet) {
            Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text("Add Set", style = MaterialTheme.typography.labelMedium)
        }
    }
}

@Composable
private fun SetRow(
    set: EditableSet,
    canRemove: Boolean,
    onChange: (EditableSet) -> Unit,
    onRemove: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedTextField(
            value = set.weight,
            onValueChange = { onChange(set.copy(weight = it)) },
            modifier = Modifier.weight(1f),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            placeholder = { Text("kg") },
            textStyle = MaterialTheme.typography.bodySmall
        )
        Spacer(modifier = Modifier.width(4.dp))
        OutlinedTextField(
            value = set.reps,
            onValueChange = { onChange(set.copy(reps = it)) },
            modifier = Modifier.weight(1f),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            placeholder = { Text("reps") },
            textStyle = MaterialTheme.typography.bodySmall
        )
        Spacer(modifier = Modifier.width(4.dp))
        OutlinedTextField(
            value = set.count,
            onValueChange = { onChange(set.copy(count = it)) },
            modifier = Modifier.weight(1f),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            placeholder = { Text("×") },
            textStyle = MaterialTheme.typography.bodySmall
        )
        if (canRemove) {
            IconButton(onClick = onRemove, modifier = Modifier.size(32.dp)) {
                Icon(
                    Icons.Default.Close, "Remove set",
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            Spacer(modifier = Modifier.width(32.dp))
        }
    }
}

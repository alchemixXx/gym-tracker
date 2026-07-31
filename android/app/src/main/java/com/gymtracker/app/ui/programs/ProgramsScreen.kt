package com.gymtracker.app.ui.programs

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gymtracker.app.data.model.Program
import com.gymtracker.app.data.model.Template
import com.gymtracker.app.util.NetworkResult

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProgramsScreen(
    onProgramClick: (Int) -> Unit,
    onNavigateToTemplates: () -> Unit,
    onNavigateToMeasurements: () -> Unit,
    onNavigateToFood: () -> Unit,
    onSwitchUser: () -> Unit,
    viewModel: ProgramsViewModel = hiltViewModel()
) {
    val programsState by viewModel.programsState.collectAsState()
    val showCreateDialog by viewModel.showCreateDialog.collectAsState()
    val templates by viewModel.templates.collectAsState()
    val userName by viewModel.userName.collectAsState()
    var programToDelete by remember { mutableStateOf<Program?>(null) }
    var showMenu by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Programs") },
                actions = {
                    IconButton(onClick = { showMenu = true }) {
                        Icon(Icons.Default.MoreVert, "Menu")
                    }
                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Templates") },
                            onClick = { showMenu = false; onNavigateToTemplates() },
                            leadingIcon = { Icon(Icons.Default.Description, null) }
                        )
                        DropdownMenuItem(
                            text = { Text("Measurements") },
                            onClick = { showMenu = false; onNavigateToMeasurements() },
                            leadingIcon = { Icon(Icons.Default.Straighten, null) }
                        )
                        DropdownMenuItem(
                            text = { Text("Food") },
                            onClick = { showMenu = false; onNavigateToFood() },
                            leadingIcon = { Icon(Icons.Default.Restaurant, null) }
                        )
                        HorizontalDivider()
                        DropdownMenuItem(
                            text = { Text("Switch User ($userName)") },
                            onClick = { showMenu = false; onSwitchUser() },
                            leadingIcon = { Icon(Icons.Default.Person, null) }
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { viewModel.showCreateDialog() }) {
                Icon(Icons.Default.Add, "New program")
            }
        }
    ) { padding ->
        when (val state = programsState) {
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
                    Button(onClick = { viewModel.loadPrograms() }) { Text("Retry") }
                }
            }

            is NetworkResult.Success -> {
                if (state.data.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            "No programs yet.\nCreate one from a template or from scratch!",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                    }
                } else {
                    val activePrograms = state.data.filter { it.status != "completed" }
                    val completedPrograms = state.data.filter { it.status == "completed" }

                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (activePrograms.isNotEmpty()) {
                            item {
                                Text(
                                    "Active",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                            items(activePrograms) { program ->
                                ProgramCard(
                                    program = program,
                                    onClick = { onProgramClick(program.id) },
                                    onDuplicate = { viewModel.duplicateProgram(program.id) },
                                    onFinish = { viewModel.finishProgram(program.id) },
                                    onDelete = { programToDelete = program }
                                )
                            }
                        }

                        if (completedPrograms.isNotEmpty()) {
                            item { Spacer(modifier = Modifier.height(8.dp)) }
                            item {
                                Text(
                                    "Completed",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            items(completedPrograms) { program ->
                                ProgramCard(
                                    program = program,
                                    onClick = { onProgramClick(program.id) },
                                    onDuplicate = { viewModel.duplicateProgram(program.id) },
                                    onFinish = null,
                                    onDelete = { programToDelete = program }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Create program dialog
    if (showCreateDialog) {
        CreateProgramDialog(
            templates = templates,
            onDismiss = { viewModel.hideCreateDialog() },
            onConfirm = { name, templateId -> viewModel.createProgram(name, templateId) }
        )
    }

    // Delete confirmation
    programToDelete?.let { program ->
        AlertDialog(
            onDismissRequest = { programToDelete = null },
            title = { Text("Delete Program") },
            text = { Text("Delete \"${program.name}\"? This cannot be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteProgram(program.id)
                        programToDelete = null
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { programToDelete = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun ProgramCard(
    program: Program,
    onClick: () -> Unit,
    onDuplicate: () -> Unit,
    onFinish: (() -> Unit)?,
    onDelete: () -> Unit
) {
    var showActions by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth().clickable { onClick() },
        colors = CardDefaults.cardColors(
            containerColor = if (program.status == "completed")
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = if (program.status == "completed") Icons.Default.CheckCircle else Icons.Default.FitnessCenter,
                    contentDescription = null,
                    tint = if (program.status == "completed") MaterialTheme.colorScheme.onSurfaceVariant
                    else MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(program.name, style = MaterialTheme.typography.titleMedium)
                    program.start_date?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                IconButton(onClick = { showActions = true }) {
                    Icon(Icons.Default.MoreVert, "Actions")
                }
                DropdownMenu(expanded = showActions, onDismissRequest = { showActions = false }) {
                    DropdownMenuItem(
                        text = { Text("Duplicate") },
                        onClick = { showActions = false; onDuplicate() },
                        leadingIcon = { Icon(Icons.Default.ContentCopy, null) }
                    )
                    if (onFinish != null) {
                        DropdownMenuItem(
                            text = { Text("Finish") },
                            onClick = { showActions = false; onFinish() },
                            leadingIcon = { Icon(Icons.Default.Done, null) }
                        )
                    }
                    DropdownMenuItem(
                        text = { Text("Delete") },
                        onClick = { showActions = false; onDelete() },
                        leadingIcon = { Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error) }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateProgramDialog(
    templates: List<Template>,
    onDismiss: () -> Unit,
    onConfirm: (String, Int?) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var selectedTemplateId by remember { mutableStateOf<Int?>(null) }
    var expanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Program") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Program Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                if (templates.isNotEmpty()) {
                    ExposedDropdownMenuBox(
                        expanded = expanded,
                        onExpandedChange = { expanded = it }
                    ) {
                        OutlinedTextField(
                            value = templates.find { it.id == selectedTemplateId }?.name ?: "No template",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("From Template") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth()
                        )
                        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                            DropdownMenuItem(
                                text = { Text("No template (empty)") },
                                onClick = { selectedTemplateId = null; expanded = false }
                            )
                            templates.forEach { template ->
                                DropdownMenuItem(
                                    text = { Text(template.name) },
                                    onClick = { selectedTemplateId = template.id; expanded = false }
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(name, selectedTemplateId) },
                enabled = name.isNotBlank()
            ) { Text("Create") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

package com.gymtracker.app.ui.programs

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gymtracker.app.data.model.Program
import com.gymtracker.app.data.model.ProgramDay
import com.gymtracker.app.util.NetworkResult

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProgramDetailScreen(
    programId: Int,
    onDayClick: (Int) -> Unit,
    onBack: () -> Unit,
    viewModel: ProgramDetailViewModel = hiltViewModel()
) {
    val programState by viewModel.programState.collectAsState()

    LaunchedEffect(programId) {
        viewModel.loadProgram(programId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (val state = programState) {
                            is NetworkResult.Success -> state.data.name
                            else -> "Program"
                        }
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                }
            )
        }
    ) { padding ->
        when (val state = programState) {
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
                    Button(onClick = { viewModel.loadProgram(programId) }) { Text("Retry") }
                }
            }

            is NetworkResult.Success -> {
                val program = state.data
                ProgramContent(
                    program = program,
                    onDayClick = onDayClick,
                    modifier = Modifier.padding(padding)
                )
            }
        }
    }
}

@Composable
private fun ProgramContent(
    program: Program,
    onDayClick: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Program info
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Status: ${program.status}", style = MaterialTheme.typography.bodyMedium)
                    program.start_date?.let {
                        Text("Started: $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(8.dp))
            Text("Training Days", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
        }

        val days = program.days ?: emptyList()
        items(days) { day ->
            DayCard(
                day = day,
                isCompleted = day.completed_at != null,
                isActive = program.status != "completed",
                onClick = { onDayClick(day.id) }
            )
        }

        if (days.isEmpty()) {
            item {
                Text(
                    "No training days in this program.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun DayCard(
    day: ProgramDay,
    isCompleted: Boolean,
    isActive: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = isActive) { onClick() },
        colors = CardDefaults.cardColors(
            containerColor = if (isCompleted)
                MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
            else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isCompleted) Icons.Default.CheckCircle else Icons.Default.PlayArrow,
                contentDescription = null,
                tint = if (isCompleted) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(day.name, style = MaterialTheme.typography.titleMedium)

                val exerciseCount = day.exercises?.size ?: 0
                Text(
                    "$exerciseCount exercise${if (exerciseCount != 1) "s" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (isCompleted) {
                    day.completed_at?.let { completedAt ->
                        Text(
                            "Completed: ${completedAt.take(10)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }
    }
}

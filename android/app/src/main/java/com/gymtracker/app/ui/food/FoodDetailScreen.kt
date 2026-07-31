package com.gymtracker.app.ui.food

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gymtracker.app.data.model.CookingBatch
import com.gymtracker.app.util.NetworkResult

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoodDetailScreen(
    foodItemId: Int,
    onBack: () -> Unit,
    viewModel: FoodDetailViewModel = hiltViewModel()
) {
    val loadState by viewModel.loadState.collectAsState()
    val detailState by viewModel.detailState.collectAsState()
    val showAddBatchDialog by viewModel.showAddBatchDialog.collectAsState()
    val showRenameDialog by viewModel.showRenameDialog.collectAsState()
    var batchToDelete by remember { mutableStateOf<CookingBatch?>(null) }

    LaunchedEffect(foodItemId) {
        viewModel.loadFoodDetail(foodItemId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(detailState.foodItem?.name ?: "Food Item") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.showRenameDialog() }) {
                        Icon(Icons.Default.Edit, "Rename")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { viewModel.showAddBatchDialog() }) {
                Icon(Icons.Default.Add, "Add batch")
            }
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
                    Button(onClick = { viewModel.loadFoodDetail(foodItemId) }) { Text("Retry") }
                }
            }

            is NetworkResult.Success -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Ratio card
                    detailState.ratio?.let { ratio ->
                        item {
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.primaryContainer
                                )
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(
                                        "Average Cooking Ratio",
                                        style = MaterialTheme.typography.titleSmall,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))

                                    if (ratio.batch_count > 0 && ratio.avg_multiplier != null) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceEvenly
                                        ) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(
                                                    "×${ratio.avg_multiplier}",
                                                    style = MaterialTheme.typography.headlineMedium,
                                                    fontWeight = FontWeight.Bold,
                                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                                )
                                                Text(
                                                    "cooked/raw",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                                )
                                            }
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text(
                                                    "${ratio.batch_count}",
                                                    style = MaterialTheme.typography.headlineMedium,
                                                    fontWeight = FontWeight.Bold,
                                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                                )
                                                Text(
                                                    "batches",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                                )
                                            }
                                        }
                                    } else {
                                        Text(
                                            "Add batches to see the ratio",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Batches header
                    item {
                        Text("Cooking Batches", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
                    }

                    if (detailState.batches.isEmpty()) {
                        item {
                            Text(
                                "No batches yet. Add one to start tracking!",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    } else {
                        items(detailState.batches) { batch ->
                            BatchCard(
                                batch = batch,
                                onDelete = { batchToDelete = batch }
                            )
                        }
                    }
                }
            }
        }
    }

    // Add batch dialog
    if (showAddBatchDialog) {
        AddBatchDialog(
            onDismiss = { viewModel.hideAddBatchDialog() },
            onConfirm = { raw, cooked, notes -> viewModel.createBatch(raw, cooked, notes) }
        )
    }

    // Rename dialog
    if (showRenameDialog) {
        var name by remember { mutableStateOf(detailState.foodItem?.name ?: "") }
        AlertDialog(
            onDismissRequest = { viewModel.hideRenameDialog() },
            title = { Text("Rename Food Item") },
            text = {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.renameFoodItem(name) },
                    enabled = name.isNotBlank()
                ) { Text("Save") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.hideRenameDialog() }) { Text("Cancel") }
            }
        )
    }

    // Delete batch confirmation
    batchToDelete?.let { batch ->
        AlertDialog(
            onDismissRequest = { batchToDelete = null },
            title = { Text("Delete Batch") },
            text = { Text("Delete this cooking batch (${batch.raw_weight}g → ${batch.cooked_weight}g)?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteBatch(batch.id)
                        batchToDelete = null
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { batchToDelete = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun BatchCard(
    batch: CookingBatch,
    onDelete: () -> Unit
) {
    val ratio = if (batch.raw_weight > 0) batch.cooked_weight / batch.raw_weight else 0.0

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "${batch.raw_weight.toInt()}g",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        " → ",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        "${batch.cooked_weight.toInt()}g",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "(×${String.format("%.2f", ratio)})",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                batch.notes?.takeIf { it.isNotBlank() }?.let { notes ->
                    Text(notes, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                batch.cooked_at?.let { date ->
                    Text(date.take(10), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Delete, "Delete", modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun AddBatchDialog(
    onDismiss: () -> Unit,
    onConfirm: (Double, Double, String?) -> Unit
) {
    var rawWeight by remember { mutableStateOf("") }
    var cookedWeight by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Cooking Batch") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = rawWeight,
                    onValueChange = { rawWeight = it },
                    label = { Text("Raw Weight (g)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = cookedWeight,
                    onValueChange = { cookedWeight = it },
                    label = { Text("Cooked Weight (g)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )

                // Show ratio preview
                val raw = rawWeight.toDoubleOrNull()
                val cooked = cookedWeight.toDoubleOrNull()
                if (raw != null && cooked != null && raw > 0) {
                    Text(
                        "Ratio: ×${String.format("%.2f", cooked / raw)}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val raw = rawWeight.toDoubleOrNull() ?: return@TextButton
                    val cooked = cookedWeight.toDoubleOrNull() ?: return@TextButton
                    onConfirm(raw, cooked, notes)
                },
                enabled = rawWeight.toDoubleOrNull() != null && cookedWeight.toDoubleOrNull() != null
            ) { Text("Add") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

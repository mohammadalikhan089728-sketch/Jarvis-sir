package com.mozahid.jarvis.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mozahid.jarvis.accessibility.JarvisAccessibilityService
import com.mozahid.jarvis.ai.AgentUiState
import com.mozahid.jarvis.ui.JarvisApplication
import com.mozahid.jarvis.ui.JarvisColors
import com.mozahid.jarvis.ui.JarvisViewModel
import com.mozahid.jarvis.ui.components.AudioWaveformBar
import com.mozahid.jarvis.ui.components.JarvisCoreOrb
import com.mozahid.jarvis.voice.VoiceState

enum class JarvisRoute(val label: String) {
    HOME("Home"),
    VOICE("Voice"),
    HISTORY("History"),
    MEMORY("Memory"),
    TASKS("Tasks"),
    AUTOMATION("Automation"),
    PERMISSIONS("Permissions"),
    SETTINGS("Settings"),
    DEVELOPER("Developer"),
    DIAGNOSTICS("Diagnostics")
}

@Composable
fun HomeScreen(viewModel: JarvisViewModel, app: JarvisApplication) {
    val agentState by viewModel.agentState.collectAsState()
    val voiceState by viewModel.voiceState.collectAsState()
    val rmsLevel by viewModel.rmsLevel.collectAsState()
    val isDbConnected by viewModel.isDbConnected.collectAsState()
    val tasks by viewModel.tasks.collectAsState()
    var inputText by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(JarvisColors.DeepBlack)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = if (isDbConnected) "Memory Sync: Connected" else "Memory Sync: Offline Cache",
                color = if (isDbConnected) JarvisColors.CyanGlow else JarvisColors.WarningAmber,
                fontSize = 12.sp
            )
            Text(
                text = "Active Tasks: ${tasks.count { it.status == "running" || it.status == "queued" }}",
                color = JarvisColors.TextSecondary,
                fontSize = 12.sp
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        JarvisCoreOrb(
            isListening = voiceState is VoiceState.Listening,
            isSpeaking = voiceState is VoiceState.Speaking,
            rmsLevel = rmsLevel
        )

        AudioWaveformBar(
            rmsLevel = rmsLevel,
            isActive = voiceState is VoiceState.Listening || voiceState is VoiceState.Speaking
        )

        Spacer(modifier = Modifier.height(12.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(JarvisColors.CardNavy, RoundedCornerShape(14.dp))
                .border(1.dp, JarvisColors.BorderBlue, RoundedCornerShape(14.dp))
                .padding(14.dp)
        ) {
            val responseText = when (val s = agentState) {
                AgentUiState.Idle -> "Good to see you, Mozahid. How can I help you today?"
                is AgentUiState.Thinking -> s.stepLabel
                is AgentUiState.Completed -> s.reply
                is AgentUiState.AwaitingConfirmation -> "Confirmation needed: ${s.pending.title}\n${s.reply}"
                is AgentUiState.Failed -> "Error: ${s.errorMessage}"
            }
            Text(text = responseText, color = JarvisColors.TextPrimary, fontSize = 14.sp)
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                placeholder = { Text("Ask JARVIS in Hinglish or English...") },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            Button(
                onClick = {
                    viewModel.sendCommand(inputText)
                    inputText = ""
                },
                colors = ButtonDefaults.buttonColors(containerColor = JarvisColors.ElectricBlue)
            ) {
                Text("Send")
            }
            OutlinedButton(
                onClick = {
                    if (voiceState is VoiceState.Listening) {
                        app.speechEngine.stopListening()
                    } else {
                        app.speechEngine.startListening(
                            languageTag = "en-IN",
                            onResult = { viewModel.sendCommand(it, speakReply = true) },
                            onError = {}
                        )
                    }
                }
            ) {
                Text(if (voiceState is VoiceState.Listening) "Stop" else "Mic")
            }
        }
    }
}

@Composable
fun VoiceAssistantScreen(viewModel: JarvisViewModel, app: JarvisApplication) {
    val voiceState by viewModel.voiceState.collectAsState()
    val rms by viewModel.rmsLevel.collectAsState()
    val settings by viewModel.settings.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(JarvisColors.DeepBlack)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Voice Assistant (Hinglish & English)", color = JarvisColors.TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
        JarvisCoreOrb(voiceState is VoiceState.Listening, voiceState is VoiceState.Speaking, rms)
        AudioWaveformBar(rms, voiceState is VoiceState.Listening || voiceState is VoiceState.Speaking)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = {
                app.speechEngine.startListening("en-IN", { viewModel.sendCommand(it, true) }, {})
            }) { Text("Speak (Hinglish)") }
            OutlinedButton(onClick = { app.speechEngine.stopSpeaking() }) { Text("Interrupt Speech") }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Hands-free \"Hey JARVIS\" Foreground Service", color = JarvisColors.TextSecondary, fontSize = 13.sp)
            Switch(
                checked = settings.wakeWordEnabled,
                onCheckedChange = { enabled ->
                    app.settingsRepository.update { it.copy(wakeWordEnabled = enabled) }
                }
            )
        }
    }
}

@Composable
fun ConversationHistoryScreen(viewModel: JarvisViewModel) {
    val messages by viewModel.conversations.collectAsState()
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(JarvisColors.DeepBlack).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { Text("Conversation History", color = JarvisColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold) }
        if (messages.isEmpty()) {
            item { Text("No synced conversations yet.", color = JarvisColors.TextSecondary) }
        }
        items(messages) { msg ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(JarvisColors.CardNavy, RoundedCornerShape(10.dp))
                    .border(1.dp, JarvisColors.BorderBlue, RoundedCornerShape(10.dp))
                    .padding(12.dp)
            ) {
                Text("${msg.role.uppercase()} · ${msg.channel}", color = JarvisColors.CyanGlow, fontSize = 11.sp)
                Spacer(Modifier.height(4.dp))
                Text(msg.content, color = JarvisColors.TextPrimary, fontSize = 14.sp)
            }
        }
    }
}

@Composable
fun MemoryManagerScreen(viewModel: JarvisViewModel) {
    val memories by viewModel.memories.collectAsState()
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var search by remember { mutableStateOf("") }

    val filtered = remember(memories, search) {
        if (search.isBlank()) memories
        else memories.filter {
            it.title.contains(search, true) || it.content.contains(search, true)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(JarvisColors.DeepBlack).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("Long-Term Memory Manager", color = JarvisColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(value = search, onValueChange = { search = it }, label = { Text("Search memories") }, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Memory title") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = content, onValueChange = { content = it }, label = { Text("Details") }, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(6.dp))
            Button(onClick = {
                if (title.isNotBlank() && content.isNotBlank()) {
                    viewModel.saveMemory(title, content, "instruction")
                    title = ""; content = ""
                }
            }) { Text("Save Memory") }
        }
        items(filtered) { mem ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(JarvisColors.CardNavy, RoundedCornerShape(10.dp))
                    .border(1.dp, JarvisColors.BorderBlue, RoundedCornerShape(10.dp))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("${mem.title} (${mem.category})", color = JarvisColors.TextPrimary, fontWeight = FontWeight.Medium)
                    Text(mem.content, color = JarvisColors.TextSecondary, fontSize = 13.sp)
                }
                OutlinedButton(onClick = { viewModel.deleteMemory(mem.id) }) { Text("Delete") }
            }
        }
    }
}

@Composable
fun TaskManagerScreen(viewModel: JarvisViewModel) {
    val tasks by viewModel.tasks.collectAsState()
    var newTaskTitle by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(JarvisColors.DeepBlack).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("Background Task Queue", color = JarvisColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(value = newTaskTitle, onValueChange = { newTaskTitle = it }, label = { Text("New task") }, modifier = Modifier.weight(1f))
                Button(onClick = {
                    if (newTaskTitle.isNotBlank()) {
                        viewModel.enqueueBackgroundTask(newTaskTitle, "Queued via Task Manager")
                        newTaskTitle = ""
                    }
                }) { Text("Queue") }
            }
        }
        items(tasks) { task ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(JarvisColors.CardNavy, RoundedCornerShape(10.dp))
                    .border(1.dp, JarvisColors.BorderBlue, RoundedCornerShape(10.dp))
                    .padding(12.dp)
            ) {
                Text("${task.title} · ${task.status.uppercase()} (${task.progress}%)", color = JarvisColors.CyanGlow, fontSize = 13.sp)
                if (task.description.isNotBlank()) {
                    Text(task.description, color = JarvisColors.TextSecondary, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun PhoneAutomationScreen(app: JarvisApplication) {
    val activePkg by JarvisAccessibilityService.activePackage.collectAsState()
    val isAccConnected by JarvisAccessibilityService.isConnected.collectAsState()
    var appQuery by remember { mutableStateOf("") }
    var outcomeMsg by remember { mutableStateOf("Ready for universal app control, CapCut, YouTube & social workflows.") }

    Column(
        modifier = Modifier.fillMaxSize().background(JarvisColors.DeepBlack).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Phone Automation & App Control", color = JarvisColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "Accessibility Service: ${if (isAccConnected) "Connected ($activePkg)" else "Disabled — Enable in Android Settings"}",
            color = if (isAccConnected) JarvisColors.SuccessGreen else JarvisColors.WarningAmber,
            fontSize = 13.sp
        )
        OutlinedTextField(value = appQuery, onValueChange = { appQuery = it }, label = { Text("App name or YouTube search") }, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                val ok = app.intentLauncher.launchAppByName(appQuery)
                outcomeMsg = if (ok) "Launched $appQuery." else "App '$appQuery' not found."
            }) { Text("Open App") }
            OutlinedButton(onClick = {
                val res = app.youTubeController.searchYouTube(appQuery)
                outcomeMsg = res.message
            }) { Text("YouTube") }
            OutlinedButton(onClick = {
                val ok = app.intentLauncher.openGoogleMapsSearch(appQuery)
                outcomeMsg = if (ok) "Opened Maps search." else "Could not open Maps."
            }) { Text("Maps") }
        }
        Text(outcomeMsg, color = JarvisColors.TextSecondary, fontSize = 13.sp)
    }
}

@Composable
fun PermissionsScreen(viewModel: JarvisViewModel, app: JarvisApplication, onRequestAccessibility: () -> Unit) {
    val permissions by viewModel.permissions.collectAsState()
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(JarvisColors.DeepBlack).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Contextual Permissions", color = JarvisColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                OutlinedButton(onClick = { viewModel.refreshPermissions() }) { Text("Refresh") }
            }
        }
        items(permissions) { perm ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(JarvisColors.CardNavy, RoundedCornerShape(10.dp))
                    .border(1.dp, JarvisColors.BorderBlue, RoundedCornerShape(10.dp))
                    .padding(12.dp)
            ) {
                Text("${perm.title} — ${if (perm.isGranted) "Granted" else "Not Granted"}",
                    color = if (perm.isGranted) JarvisColors.SuccessGreen else JarvisColors.WarningAmber,
                    fontWeight = FontWeight.Medium)
                Text(perm.rationale, color = JarvisColors.TextSecondary, fontSize = 12.sp)
                if (perm.isSystemSettingsRequired && !perm.isGranted) {
                    Spacer(Modifier.height(6.dp))
                    Button(onClick = onRequestAccessibility) { Text("Open Accessibility Settings") }
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(viewModel: JarvisViewModel, app: JarvisApplication) {
    val settings by viewModel.settings.collectAsState()
    var modelId by remember(settings.activeModelId) { mutableStateOf(settings.activeModelId) }
    var dbUrl by remember(settings.databaseUrl) { mutableStateOf(settings.databaseUrl) }
    var proxyUrl by remember(settings.proxyBaseUrl) { mutableStateOf(settings.proxyBaseUrl) }
    var feedback by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().background(JarvisColors.DeepBlack).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("JARVIS Settings (Owner: ${settings.ownerName})", color = JarvisColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
        OutlinedTextField(value = modelId, onValueChange = { modelId = it }, label = { Text("Configurable Gemini Model ID") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = dbUrl, onValueChange = { dbUrl = it }, label = { Text("Singapore Firebase RTDB URL") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = proxyUrl, onValueChange = { proxyUrl = it }, label = { Text("Backend Proxy Base URL") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = {
            val res = app.modelConfigService.setActiveModel(modelId)
            app.settingsRepository.update { it.copy(databaseUrl = dbUrl, proxyBaseUrl = proxyUrl) }
            feedback = if (res.isSuccess) "Settings saved." else res.exceptionOrNull()?.localizedMessage.orEmpty()
        }) { Text("Save Configuration") }
        if (feedback.isNotBlank()) Text(feedback, color = JarvisColors.CyanGlow, fontSize = 13.sp)
    }
}

@Composable
fun DeveloperWorkspaceScreen(viewModel: JarvisViewModel) {
    var name by remember { mutableStateOf("patna_restaurant_demo") }
    var html by remember { mutableStateOf("<!doctype html><html><body><h1>Demo</h1></body></html>") }
    val status by viewModel.statusMessage.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().background(JarvisColors.DeepBlack).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("Developer Workspace", color = JarvisColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Project Name") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = html, onValueChange = { html = it }, label = { Text("index.html") }, modifier = Modifier.fillMaxWidth().weight(1f))
        Button(onClick = { viewModel.saveWorkspaceProject(name, html, "", "", overwrite = false) }) {
            Text("Save Project Files")
        }
        Text(status, color = JarvisColors.TextSecondary, fontSize = 12.sp)
    }
}

@Composable
fun SystemDiagnosticsScreen(viewModel: JarvisViewModel) {
    val models by viewModel.models.collectAsState()
    val isDbConnected by viewModel.isDbConnected.collectAsState()
    val status by viewModel.statusMessage.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().background(JarvisColors.DeepBlack).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("System Diagnostics (Realme 6)", color = JarvisColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
        Text("Firebase RTDB Status: ${if (isDbConnected) "Connected" else "Offline / Auth Pending"}", color = JarvisColors.CyanGlow)
        Text("Status: $status", color = JarvisColors.TextSecondary)
        Button(onClick = { viewModel.checkAvailableModels() }) { Text("Verify Gemini Models") }
        models.forEach { m ->
            Text("• ${m.id} (${m.label})", color = JarvisColors.TextPrimary, fontSize = 13.sp)
        }
    }
}

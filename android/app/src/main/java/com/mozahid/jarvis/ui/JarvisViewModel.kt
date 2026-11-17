package com.mozahid.jarvis.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mozahid.jarvis.ai.AgentUiState
import com.mozahid.jarvis.ai.ApiResult
import com.mozahid.jarvis.ai.ModelDescriptor
import com.mozahid.jarvis.developer.WorkspaceProjectRecord
import com.mozahid.jarvis.memory.ConversationTurn
import com.mozahid.jarvis.memory.MemoryRecord
import com.mozahid.jarvis.security.PermissionStatus
import com.mozahid.jarvis.tasks.JarvisTask
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class JarvisViewModel(private val app: JarvisApplication) : ViewModel() {

    private val _agentState = MutableStateFlow<AgentUiState>(AgentUiState.Idle)
    val agentState: StateFlow<AgentUiState> = _agentState.asStateFlow()

    private val _memories = MutableStateFlow<List<MemoryRecord>>(emptyList())
    val memories: StateFlow<List<MemoryRecord>> = _memories.asStateFlow()

    private val _conversations = MutableStateFlow<List<ConversationTurn>>(emptyList())
    val conversations: StateFlow<List<ConversationTurn>> = _conversations.asStateFlow()

    private val _tasks = MutableStateFlow<List<JarvisTask>>(emptyList())
    val tasks: StateFlow<List<JarvisTask>> = _tasks.asStateFlow()

    private val _models = MutableStateFlow<List<ModelDescriptor>>(emptyList())
    val models: StateFlow<List<ModelDescriptor>> = _models.asStateFlow()

    private val _permissions = MutableStateFlow<List<PermissionStatus>>(emptyList())
    val permissions: StateFlow<List<PermissionStatus>> = _permissions.asStateFlow()

    private val _isDbConnected = MutableStateFlow(false)
    val isDbConnected: StateFlow<Boolean> = _isDbConnected.asStateFlow()

    private val _statusMessage = MutableStateFlow("Ready for Mozahid")
    val statusMessage: StateFlow<String> = _statusMessage.asStateFlow()

    val settings = app.settingsRepository.settings
    val voiceState = app.speechEngine.voiceState
    val rmsLevel = app.speechEngine.rmsLevel

    init {
        app.speechEngine.initializeTts(settings.value.ttsSpeechRate)
        refreshPermissions()
        observeFirebaseStreams()
        checkAvailableModels()
        initializeFirebaseProfileSafely()
    }

    private fun initializeFirebaseProfileSafely() {
        viewModelScope.launch {
            if (app.authManager.currentUser == null || !app.databaseManager.isConfigured()) return@launch
            val current = settings.value
            app.databaseManager.initializeProfileIfMissing(
                mapOf(
                    "ownerName" to current.ownerName,
                    "deviceModel" to current.deviceModel,
                    "primaryLanguage" to current.primaryLanguage,
                    "secondaryLanguage" to current.secondaryLanguage,
                    "createdAt" to System.currentTimeMillis(),
                    "updatedAt" to System.currentTimeMillis()
                )
            )
            app.databaseManager.logActivity("startup", "JARVIS initialized for ${current.ownerName}")
        }
    }

    private fun observeFirebaseStreams() {
        viewModelScope.launch {
            app.databaseManager.observeConnection().collect { connected ->
                _isDbConnected.value = connected
            }
        }
        viewModelScope.launch {
            app.memoryRepository.observeMemories().collect { result ->
                result.onSuccess { _memories.value = it }
            }
        }
        viewModelScope.launch {
            app.memoryRepository.observeConversations().collect { result ->
                result.onSuccess { _conversations.value = it }
            }
        }
        viewModelScope.launch {
            app.taskQueueManager.observeTasks().collect { result ->
                result.onSuccess { _tasks.value = it }
            }
        }
    }

    fun refreshPermissions() {
        _permissions.value = app.permissionAuditManager.auditAll()
    }

    fun checkAvailableModels() {
        viewModelScope.launch {
            when (val res = app.proxyClient.fetchAvailableModels()) {
                is ApiResult.Success -> _models.value = res.data
                is ApiResult.Failure -> _statusMessage.value = "Model check failed: ${res.message}"
                is ApiResult.NetworkError -> _statusMessage.value = res.message
                else -> {}
            }
        }
    }

    fun sendCommand(text: String, speakReply: Boolean = false) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            _agentState.value = AgentUiState.Thinking("Analyzing request...")
            val memorySnippets = _memories.value.take(10).map { "[${it.category}] ${it.title}: ${it.content}" }
            val result = app.orchestrator.processInstruction(
                userText = trimmed,
                history = _conversations.value,
                memorySnippets = memorySnippets
            )
            _agentState.value = result
            if (result is AgentUiState.Failed) {
                app.databaseManager.logActivity("error", result.errorMessage)
            }
            if (speakReply && result is AgentUiState.Completed) {
                app.speechEngine.speak(result.reply)
            }
        }
    }

    fun saveMemory(title: String, content: String, category: String) {
        viewModelScope.launch {
            val res = app.memoryRepository.saveMemory(
                MemoryRecord(title = title, content = content, category = category)
            )
            _statusMessage.value = if (res.isSuccess) {
                "Memory saved to Firebase."
            } else {
                "Save failed: ${res.exceptionOrNull()?.localizedMessage}"
            }
        }
    }

    fun deleteMemory(memoryId: String) {
        viewModelScope.launch {
            val res = app.memoryRepository.deleteMemory(memoryId)
            _statusMessage.value = if (res.isSuccess) "Memory deleted." else "Delete failed."
        }
    }

    fun clearAllMemories() {
        viewModelScope.launch {
            val res = app.memoryRepository.clearAllMemories()
            _statusMessage.value = if (res.isSuccess) "Memory cleared." else "Clear failed."
        }
    }

    fun clearConversations() {
        viewModelScope.launch {
            val res = app.memoryRepository.clearConversations()
            _statusMessage.value = if (res.isSuccess) "Conversation history cleared." else "Clear failed."
        }
    }

    fun syncPreferencesToFirebase() {
        viewModelScope.launch {
            val s = settings.value
            app.databaseManager.writeObject(
                "preferences",
                mapOf(
                    "activeModelId" to s.activeModelId,
                    "primaryLanguage" to s.primaryLanguage,
                    "secondaryLanguage" to s.secondaryLanguage,
                    "wakeWordEnabled" to s.wakeWordEnabled,
                    "ttsSpeechRate" to s.ttsSpeechRate,
                    "confirmSensitiveActions" to s.confirmSensitiveActions,
                    "updatedAt" to System.currentTimeMillis()
                )
            )
        }
    }

    fun enqueueBackgroundTask(title: String, description: String) {
        viewModelScope.launch {
            val res = app.taskQueueManager.enqueueTask(title, description, "automation")
            _statusMessage.value = if (res.isSuccess) {
                "Understood Mozahid. I've started the task."
            } else {
                "Task queue failed: ${res.exceptionOrNull()?.localizedMessage}"
            }
        }
    }

    fun saveWorkspaceProject(name: String, html: String, css: String, js: String, overwrite: Boolean) {
        viewModelScope.launch {
            val res = app.developerWorkspaceRepository.saveProject(
                WorkspaceProjectRecord(name = name, entryHtml = html, entryCss = css, entryJs = js),
                overwriteConfirmed = overwrite
            )
            _statusMessage.value = if (res.isSuccess) {
                "Project '$name' saved."
            } else {
                res.exceptionOrNull()?.localizedMessage ?: "Failed to save project."
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        app.speechEngine.release()
    }
}

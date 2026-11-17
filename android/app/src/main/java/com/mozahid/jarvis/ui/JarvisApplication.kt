package com.mozahid.jarvis.ui

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.mozahid.jarvis.BuildConfig
import com.mozahid.jarvis.ai.GeminiProxyClient
import com.mozahid.jarvis.ai.JarvisAgentOrchestrator
import com.mozahid.jarvis.ai.ModelConfigService
import com.mozahid.jarvis.ai.ToolRegistry
import com.mozahid.jarvis.automation.IntentLauncher
import com.mozahid.jarvis.automation.UniversalAppController
import com.mozahid.jarvis.automation.YouTubeMusicController
import com.mozahid.jarvis.calls.CallController
import com.mozahid.jarvis.contacts.ContactsRepository
import com.mozahid.jarvis.developer.DeveloperWorkspaceRepository
import com.mozahid.jarvis.firebase.FirebaseAuthManager
import com.mozahid.jarvis.firebase.FirebaseDatabaseManager
import com.mozahid.jarvis.memory.LongTermMemoryRepository
import com.mozahid.jarvis.screenvision.MultimodalScreenAnalyzer
import com.mozahid.jarvis.security.PermissionAuditManager
import com.mozahid.jarvis.security.SecureStorageManager
import com.mozahid.jarvis.settings.SettingsRepository
import com.mozahid.jarvis.tasks.TaskQueueManager
import com.mozahid.jarvis.voice.HinglishSpeechEngine

class JarvisApplication : Application() {

    lateinit var secureStorage: SecureStorageManager
    lateinit var settingsRepository: SettingsRepository
    lateinit var authManager: FirebaseAuthManager
    lateinit var databaseManager: FirebaseDatabaseManager
    lateinit var memoryRepository: LongTermMemoryRepository
    lateinit var taskQueueManager: TaskQueueManager
    lateinit var modelConfigService: ModelConfigService
    lateinit var proxyClient: GeminiProxyClient
    lateinit var toolRegistry: ToolRegistry
    lateinit var orchestrator: JarvisAgentOrchestrator
    lateinit var speechEngine: HinglishSpeechEngine
    lateinit var intentLauncher: IntentLauncher
    lateinit var youTubeController: YouTubeMusicController
    lateinit var contactsRepository: ContactsRepository
    lateinit var callController: CallController
    lateinit var permissionAuditManager: PermissionAuditManager
    lateinit var screenAnalyzer: MultimodalScreenAnalyzer
    lateinit var developerWorkspaceRepository: DeveloperWorkspaceRepository

    override fun onCreate() {
        super.onCreate()
        runCatching {
            FirebaseApp.initializeApp(this)
            FirebaseAppCheck.getInstance()
                .installAppCheckProviderFactory(PlayIntegrityAppCheckProviderFactory.getInstance())
        }

        secureStorage = SecureStorageManager(this)
        settingsRepository = SettingsRepository(secureStorage)
        authManager = FirebaseAuthManager()
        databaseManager = FirebaseDatabaseManager(
            databaseUrl = settingsRepository.settings.value.databaseUrl.ifBlank { BuildConfig.JARVIS_DATABASE_URL },
            authManager = authManager
        )
        memoryRepository = LongTermMemoryRepository(databaseManager)
        taskQueueManager = TaskQueueManager(this, databaseManager)
        modelConfigService = ModelConfigService(settingsRepository)
        proxyClient = GeminiProxyClient(settingsRepository, modelConfigService, authManager)

        intentLauncher = IntentLauncher(this)
        youTubeController = YouTubeMusicController(this)
        toolRegistry = ToolRegistry().apply {
            UniversalAppController(intentLauncher, youTubeController).buildAutomationTools().forEach {
                register(it)
            }
        }

        orchestrator = JarvisAgentOrchestrator(proxyClient, memoryRepository, toolRegistry)
        speechEngine = HinglishSpeechEngine(this)
        contactsRepository = ContactsRepository(this)
        callController = CallController(this)
        permissionAuditManager = PermissionAuditManager(this)
        screenAnalyzer = MultimodalScreenAnalyzer(proxyClient)
        developerWorkspaceRepository = DeveloperWorkspaceRepository(this, databaseManager)
    }
}

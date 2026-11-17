package com.mozahid.jarvis.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.mozahid.jarvis.ui.screens.ConversationHistoryScreen
import com.mozahid.jarvis.ui.screens.DeveloperWorkspaceScreen
import com.mozahid.jarvis.ui.screens.HomeScreen
import com.mozahid.jarvis.ui.screens.JarvisRoute
import com.mozahid.jarvis.ui.screens.MemoryManagerScreen
import com.mozahid.jarvis.ui.screens.PermissionsScreen
import com.mozahid.jarvis.ui.screens.PhoneAutomationScreen
import com.mozahid.jarvis.ui.screens.SettingsScreen
import com.mozahid.jarvis.ui.screens.SystemDiagnosticsScreen
import com.mozahid.jarvis.ui.screens.TaskManagerScreen
import com.mozahid.jarvis.ui.screens.VoiceAssistantScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as JarvisApplication
        val viewModel = JarvisViewModel(app)

        setContent {
            JarvisTheme {
                var currentRoute by remember { mutableStateOf(JarvisRoute.HOME) }
                Scaffold(
                    containerColor = JarvisColors.DeepBlack,
                    topBar = {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState())
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            JarvisRoute.entries.forEach { route ->
                                FilterChip(
                                    selected = currentRoute == route,
                                    onClick = { currentRoute = route },
                                    label = { Text(route.label) }
                                )
                            }
                        }
                    }
                ) { padding ->
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding)
                    ) {
                        when (currentRoute) {
                            JarvisRoute.HOME -> HomeScreen(viewModel, app)
                            JarvisRoute.VOICE -> VoiceAssistantScreen(viewModel, app)
                            JarvisRoute.HISTORY -> ConversationHistoryScreen(viewModel)
                            JarvisRoute.MEMORY -> MemoryManagerScreen(viewModel)
                            JarvisRoute.TASKS -> TaskManagerScreen(viewModel)
                            JarvisRoute.AUTOMATION -> PhoneAutomationScreen(app)
                            JarvisRoute.PERMISSIONS -> PermissionsScreen(
                                viewModel,
                                app,
                                onRequestAccessibility = {
                                    startActivity(app.permissionAuditManager.openAccessibilitySettingsIntent())
                                }
                            )
                            JarvisRoute.SETTINGS -> SettingsScreen(viewModel, app)
                            JarvisRoute.DEVELOPER -> DeveloperWorkspaceScreen(viewModel)
                            JarvisRoute.DIAGNOSTICS -> SystemDiagnosticsScreen(viewModel)
                        }
                    }
                }
            }
        }
    }
}

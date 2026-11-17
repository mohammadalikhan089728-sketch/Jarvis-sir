package com.mozahid.jarvis.developer

import android.content.Context
import com.mozahid.jarvis.firebase.FirebaseDatabaseManager
import java.io.File
import java.util.UUID

data class WorkspaceProjectRecord(
    val id: String = "proj_${UUID.randomUUID().toString().replace("-", "").take(14)}",
    val name: String = "",
    val stack: String = "HTML/CSS/JS",
    val summary: String = "",
    val entryHtml: String = "",
    val entryCss: String = "",
    val entryJs: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

class DeveloperWorkspaceRepository(
    private val context: Context,
    private val dbManager: FirebaseDatabaseManager
) {
    private val rootDir: File by lazy {
        File(context.filesDir, "jarvis_projects").apply { mkdirs() }
    }

    fun projectFileExists(projectName: String, fileName: String): Boolean {
        val safeName = projectName.replace(Regex("[^a-zA-Z0-9_-]"), "_")
        return File(File(rootDir, safeName), fileName).exists()
    }

    suspend fun saveProject(
        project: WorkspaceProjectRecord,
        overwriteConfirmed: Boolean
    ): Result<WorkspaceProjectRecord> {
        val safeName = project.name.replace(Regex("[^a-zA-Z0-9_-]"), "_").ifBlank { project.id }
        val dir = File(rootDir, safeName).apply { mkdirs() }
        val htmlFile = File(dir, "index.html")
        if (htmlFile.exists() && !overwriteConfirmed) {
            return Result.failure(
                IllegalStateException("Project file index.html already exists. Confirmation required before overwriting.")
            )
        }

        htmlFile.writeText(project.entryHtml)
        File(dir, "styles.css").writeText(project.entryCss)
        File(dir, "app.js").writeText(project.entryJs)

        val now = System.currentTimeMillis()
        val stamped = project.copy(updatedAt = now)
        val payload = mapOf(
            "id" to stamped.id,
            "name" to stamped.name,
            "stack" to stamped.stack,
            "summary" to stamped.summary,
            "entryHtml" to stamped.entryHtml,
            "entryCss" to stamped.entryCss,
            "entryJs" to stamped.entryJs,
            "createdAt" to stamped.createdAt,
            "updatedAt" to stamped.updatedAt
        )
        return dbManager.writeRecord("projects", stamped.id, payload).map { stamped }
    }

    fun listLocalProjects(): List<String> =
        rootDir.listFiles()?.filter { it.isDirectory }?.map { it.name } ?: emptyList()
}

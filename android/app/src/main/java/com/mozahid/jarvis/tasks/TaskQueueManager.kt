package com.mozahid.jarvis.tasks

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.ValueEventListener
import com.mozahid.jarvis.firebase.FirebaseDatabaseManager
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOf
import java.util.UUID
import java.util.concurrent.TimeUnit

data class JarvisTask(
    val id: String = "task_${UUID.randomUUID().toString().replace("-", "").take(16)}",
    val title: String = "",
    val description: String = "",
    val category: String = "automation",
    val status: String = "queued",
    val progress: Int = 0,
    val retryCount: Int = 0,
    val lastError: String = "",
    val resultSummary: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

class TaskQueueManager(
    private val context: Context,
    private val dbManager: FirebaseDatabaseManager
) {
    private val workManager = WorkManager.getInstance(context)

    fun observeTasks(): Flow<Result<List<JarvisTask>>> {
        val root = dbManager.userRoot()
            ?: return flowOf(Result.failure(IllegalStateException("Firebase authentication required")))
        return callbackFlow {
            val ref = root.child("tasks")
            val listener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    val items = snapshot.children.mapNotNull {
                        it.getValue(JarvisTask::class.java)
                    }.sortedByDescending { it.updatedAt }
                    trySend(Result.success(items))
                }

                override fun onCancelled(error: DatabaseError) {
                    trySend(Result.failure(error.toException()))
                }
            }
            ref.addValueEventListener(listener)
            awaitClose { ref.removeEventListener(listener) }
        }
    }

    suspend fun enqueueTask(title: String, description: String, category: String): Result<JarvisTask> {
        val task = JarvisTask(
            title = title,
            description = description,
            category = category,
            status = "queued",
            progress = 5
        )
        val payload = mapOf(
            "id" to task.id,
            "title" to task.title,
            "description" to task.description,
            "category" to task.category,
            "status" to task.status,
            "progress" to task.progress,
            "retryCount" to task.retryCount,
            "lastError" to task.lastError,
            "resultSummary" to task.resultSummary,
            "createdAt" to task.createdAt,
            "updatedAt" to task.updatedAt
        )
        val saved = dbManager.writeRecord("tasks", task.id, payload)
        if (saved.isFailure) return Result.failure(saved.exceptionOrNull()!!)

        val inputData = Data.Builder()
            .putString("taskId", task.id)
            .putString("title", task.title)
            .putString("description", task.description)
            .build()

        val request = OneTimeWorkRequestBuilder<JarvisBackgroundWorker>()
            .setInputData(inputData)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
            .addTag(task.id)
            .build()

        workManager.enqueueUniqueWork(task.id, ExistingWorkPolicy.REPLACE, request)
        return Result.success(task)
    }

    suspend fun cancelTask(task: JarvisTask): Result<Unit> {
        workManager.cancelUniqueWork(task.id)
        val payload = mapOf(
            "id" to task.id,
            "title" to task.title,
            "description" to task.description,
            "category" to task.category,
            "status" to "cancelled",
            "progress" to task.progress,
            "retryCount" to task.retryCount,
            "lastError" to task.lastError,
            "resultSummary" to task.resultSummary,
            "createdAt" to task.createdAt,
            "updatedAt" to System.currentTimeMillis()
        )
        return dbManager.writeRecord("tasks", task.id, payload)
    }
}

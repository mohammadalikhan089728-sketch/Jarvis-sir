package com.mozahid.jarvis.memory

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.ValueEventListener
import com.mozahid.jarvis.firebase.FirebaseDatabaseManager
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOf

class LongTermMemoryRepository(private val dbManager: FirebaseDatabaseManager) {

    fun observeMemories(): Flow<Result<List<MemoryRecord>>> {
        val root = dbManager.userRoot()
            ?: return flowOf(Result.failure(IllegalStateException("Firebase authentication or FIREBASE_DATABASE_URL required")))

        return callbackFlow {
            val ref = root.child("memory")
            val listener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    val items = snapshot.children.mapNotNull { child ->
                        child.getValue(MemoryRecord::class.java)
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

    suspend fun saveMemory(record: MemoryRecord): Result<MemoryRecord> {
        if (containsSensitiveSecret(record.content) || containsSensitiveSecret(record.title)) {
            return Result.failure(
                IllegalArgumentException("Refused to persist sensitive credentials, API keys, or tokens into memory.")
            )
        }
        val now = System.currentTimeMillis()
        val stamped = record.copy(
            createdAt = if (record.createdAt == 0L) now else record.createdAt,
            updatedAt = now
        )
        val payload = mapOf(
            "id" to stamped.id,
            "category" to stamped.category,
            "title" to stamped.title,
            "content" to stamped.content,
            "tags" to stamped.tags,
            "importance" to stamped.importance,
            "createdAt" to stamped.createdAt,
            "updatedAt" to stamped.updatedAt
        )
        return dbManager.writeRecord("memory", stamped.id, payload).map { stamped }
    }

    suspend fun updateMemory(record: MemoryRecord): Result<MemoryRecord> = saveMemory(record)

    suspend fun deleteMemory(memoryId: String): Result<Unit> =
        dbManager.deleteRecord("memory", memoryId)

    suspend fun clearAllMemories(): Result<Unit> =
        dbManager.clearPath("memory")

    suspend fun saveConversationTurn(turn: ConversationTurn): Result<ConversationTurn> {
        val safeContent = if (containsSensitiveSecret(turn.content)) {
            "[Sensitive credential content redacted]"
        } else {
            turn.content
        }
        val payload = mapOf(
            "id" to turn.id,
            "sessionId" to turn.sessionId,
            "role" to turn.role,
            "content" to safeContent,
            "channel" to turn.channel,
            "modelUsed" to turn.modelUsed,
            "createdAt" to turn.createdAt
        )
        return dbManager.writeRecord("conversations", turn.id, payload).map { turn.copy(content = safeContent) }
    }

    suspend fun clearConversations(): Result<Unit> =
        dbManager.clearPath("conversations")

    fun observeConversations(): Flow<Result<List<ConversationTurn>>> {
        val root = dbManager.userRoot()
            ?: return flowOf(Result.failure(IllegalStateException("Firebase authentication or FIREBASE_DATABASE_URL required")))

        return callbackFlow {
            val ref = root.child("conversations").limitToLast(200)
            val listener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    val items = snapshot.children.mapNotNull {
                        it.getValue(ConversationTurn::class.java)
                    }.sortedBy { it.createdAt }
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

    fun searchLocal(items: List<MemoryRecord>, query: String): List<MemoryRecord> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return items
        return items.filter {
            it.title.lowercase().contains(q) ||
                it.content.lowercase().contains(q) ||
                it.category.lowercase().contains(q) ||
                it.tags.any { tag -> tag.lowercase().contains(q) }
        }
    }

    private fun containsSensitiveSecret(text: String): Boolean {
        return Regex("AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z]{20,}|-----BEGIN PRIVATE KEY-----").containsMatchIn(text)
    }
}

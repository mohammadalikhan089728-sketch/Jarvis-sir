package com.mozahid.jarvis.firebase

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.tasks.await
import java.util.UUID

sealed class SyncState {
    data object Idle : SyncState()
    data object Syncing : SyncState()
    data class Connected(val lastSyncedAt: Long) : SyncState()
    data class Error(val message: String) : SyncState()
}

class FirebaseDatabaseManager(
    private val databaseUrl: String,
    private val authManager: FirebaseAuthManager
) {
    fun isConfigured(): Boolean = databaseUrl.trim().startsWith("https://")

    private val database: FirebaseDatabase? by lazy {
        if (!isConfigured()) return@lazy null
        val instance = FirebaseDatabase.getInstance(databaseUrl.trim())
        runCatching { instance.setPersistenceEnabled(true) }
        instance
    }

    fun userRoot(): DatabaseReference? {
        val db = database ?: return null
        val uid = authManager.currentUser?.uid ?: return null
        return db.getReference("users").child(uid).also {
            it.keepSynced(true)
        }
    }

    fun observeConnection(): Flow<Boolean> {
        val db = database ?: return flowOf(false)
        return callbackFlow {
            val connectedRef = db.getReference(".info/connected")
            val listener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    trySend(snapshot.getValue(Boolean::class.java) == true)
                }

                override fun onCancelled(error: DatabaseError) {
                    trySend(false)
                }
            }
            connectedRef.addValueEventListener(listener)
            awaitClose { connectedRef.removeEventListener(listener) }
        }
    }

    /**
     * Initializes /users/{uid}/profile ONLY if it does not already exist,
     * ensuring existing owner data is never overwritten on app startup.
     */
    suspend fun initializeProfileIfMissing(profilePayload: Map<String, Any?>): Result<Boolean> {
        if (!isConfigured()) {
            return Result.failure(IllegalStateException("FIREBASE_DATABASE_URL is missing."))
        }
        val root = userRoot()
            ?: return Result.failure(IllegalStateException("Firebase authentication required."))
        return try {
            val profileRef = root.child("profile")
            val existing = profileRef.get().await()
            if (existing.exists()) {
                Result.success(false)
            } else {
                profileRef.setValue(profilePayload).await()
                Result.success(true)
            }
        } catch (e: Exception) {
            Result.failure(IllegalStateException(sanitizeMessage(e.localizedMessage)))
        }
    }

    suspend fun writeObject(path: String, payload: Map<String, Any?>): Result<Unit> {
        if (!isConfigured()) {
            return Result.failure(IllegalStateException("FIREBASE_DATABASE_URL is missing."))
        }
        val root = userRoot()
            ?: return Result.failure(IllegalStateException("Not authenticated with Firebase"))
        return try {
            root.child(path).updateChildren(payload).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(IllegalStateException(sanitizeMessage(e.localizedMessage)))
        }
    }

    suspend fun writeRecord(path: String, id: String, payload: Map<String, Any?>): Result<Unit> {
        if (!isConfigured()) {
            return Result.failure(IllegalStateException("FIREBASE_DATABASE_URL is missing."))
        }
        val root = userRoot()
            ?: return Result.failure(IllegalStateException("Not authenticated with Firebase"))
        return try {
            root.child(path).child(id).setValue(payload).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(IllegalStateException(sanitizeMessage(e.localizedMessage)))
        }
    }

    suspend fun deleteRecord(path: String, id: String): Result<Unit> {
        if (!isConfigured()) {
            return Result.failure(IllegalStateException("FIREBASE_DATABASE_URL is missing."))
        }
        val root = userRoot()
            ?: return Result.failure(IllegalStateException("Not authenticated with Firebase"))
        return try {
            root.child(path).child(id).removeValue().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(IllegalStateException(sanitizeMessage(e.localizedMessage)))
        }
    }

    suspend fun clearPath(path: String): Result<Unit> {
        if (!isConfigured()) {
            return Result.failure(IllegalStateException("FIREBASE_DATABASE_URL is missing."))
        }
        val root = userRoot()
            ?: return Result.failure(IllegalStateException("Not authenticated with Firebase"))
        return try {
            root.child(path).removeValue().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(IllegalStateException(sanitizeMessage(e.localizedMessage)))
        }
    }

    suspend fun logActivity(type: String, summary: String): Result<Unit> {
        val id = "act_${UUID.randomUUID().toString().replace("-", "").take(14)}"
        return writeRecord(
            "activity",
            id,
            mapOf(
                "id" to id,
                "type" to type.take(60),
                "summary" to sanitizeMessage(summary).take(500),
                "createdAt" to System.currentTimeMillis()
            )
        )
    }

    private fun sanitizeMessage(msg: String?): String {
        if (msg.isNullOrBlank()) return "Firebase Realtime Database operation failed."
        return msg
            .replace(Regex("https://[^\\s]+"), "[REDACTED_URL]")
            .replace(Regex("AIza[0-9A-Za-z_-]{20,}"), "[REDACTED_KEY]")
    }
}

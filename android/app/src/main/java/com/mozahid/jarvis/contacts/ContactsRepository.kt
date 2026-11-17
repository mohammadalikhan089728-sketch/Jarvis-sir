package com.mozahid.jarvis.contacts

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.ContactsContract
import androidx.core.content.ContextCompat

data class ContactMatch(
    val id: String,
    val displayName: String,
    val phoneNumber: String
)

class ContactsRepository(private val context: Context) {

    fun searchByName(query: String): Result<List<ContactMatch>> {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            return Result.failure(SecurityException("READ_CONTACTS permission is required."))
        }

        val q = query.trim()
        if (q.isEmpty()) return Result.success(emptyList())

        val matches = mutableListOf<ContactMatch>()
        val uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
        )
        val selection = "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?"
        val selectionArgs = arrayOf("%$q%")

        context.contentResolver.query(uri, projection, selection, selectionArgs, null)?.use { cursor ->
            val idIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
            val nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
            val numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
            while (cursor.moveToNext() && matches.size < 15) {
                val id = if (idIdx >= 0) cursor.getString(idIdx).orEmpty() else ""
                val name = if (nameIdx >= 0) cursor.getString(nameIdx).orEmpty() else ""
                val num = if (numIdx >= 0) cursor.getString(numIdx).orEmpty() else ""
                if (name.isNotBlank() && num.isNotBlank()) {
                    matches.add(ContactMatch(id, name, num))
                }
            }
        }
        return Result.success(matches.distinctBy { "${it.displayName}_${it.phoneNumber}" })
    }
}

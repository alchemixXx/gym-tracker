package com.gymtracker.app.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.gymtracker.app.data.api.GymTrackerApi
import com.gymtracker.app.data.model.User
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "user_prefs")

@Singleton
class UserRepository @Inject constructor(
    private val api: GymTrackerApi,
    @ApplicationContext private val context: Context
) {
    private val selectedUserIdKey = intPreferencesKey("selected_user_id")
    private val selectedUserNameKey = stringPreferencesKey("selected_user_name")

    val selectedUserId: Flow<Int?> = context.dataStore.data.map { prefs ->
        prefs[selectedUserIdKey]
    }

    val selectedUserName: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[selectedUserNameKey]
    }

    suspend fun selectUser(user: User) {
        context.dataStore.edit { prefs ->
            prefs[selectedUserIdKey] = user.id
            prefs[selectedUserNameKey] = user.name
        }
    }

    suspend fun clearSelection() {
        context.dataStore.edit { prefs ->
            prefs.remove(selectedUserIdKey)
            prefs.remove(selectedUserNameKey)
        }
    }

    suspend fun getUsers(): List<User> = api.getUsers()

    suspend fun createUser(name: String): User = api.createUser(mapOf("name" to name))
}

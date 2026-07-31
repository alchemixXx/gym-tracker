package com.gymtracker.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.gymtracker.app.data.repository.UserRepository
import com.gymtracker.app.ui.navigation.NavGraph
import com.gymtracker.app.ui.navigation.Routes
import com.gymtracker.app.ui.theme.GymTrackerTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var userRepository: UserRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            GymTrackerTheme {
                val selectedUserId by userRepository.selectedUserId.collectAsState(initial = null)
                val navController = rememberNavController()

                val startDestination = if (selectedUserId != null) {
                    Routes.PROGRAMS
                } else {
                    Routes.USER_SELECT
                }

                Surface(modifier = Modifier.fillMaxSize()) {
                    NavGraph(
                        navController = navController,
                        startDestination = startDestination
                    )
                }
            }
        }
    }
}

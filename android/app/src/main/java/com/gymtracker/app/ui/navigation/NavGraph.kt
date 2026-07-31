package com.gymtracker.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.gymtracker.app.ui.food.FoodDetailScreen
import com.gymtracker.app.ui.food.FoodScreen
import com.gymtracker.app.ui.measurements.MeasurementsScreen
import com.gymtracker.app.ui.programs.GymSessionScreen
import com.gymtracker.app.ui.programs.ProgramDetailScreen
import com.gymtracker.app.ui.programs.ProgramsScreen
import com.gymtracker.app.ui.templates.TemplateDetailScreen
import com.gymtracker.app.ui.templates.TemplatesScreen
import com.gymtracker.app.ui.users.UserSelectScreen

object Routes {
    const val USER_SELECT = "users"
    const val PROGRAMS = "programs"
    const val PROGRAM_DETAIL = "programs/{programId}"
    const val GYM_SESSION = "session/{programId}/{dayId}"
    const val TEMPLATES = "templates"
    const val TEMPLATE_DETAIL = "templates/{templateId}"
    const val TEMPLATE_CREATE = "templates/new"
    const val MEASUREMENTS = "measurements"
    const val FOOD = "food"
    const val FOOD_DETAIL = "food/{foodItemId}"
}

@Composable
fun NavGraph(
    navController: NavHostController,
    startDestination: String = Routes.USER_SELECT
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Routes.USER_SELECT) {
            UserSelectScreen(
                onUserSelected = {
                    navController.navigate(Routes.PROGRAMS) {
                        popUpTo(Routes.USER_SELECT) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.PROGRAMS) {
            ProgramsScreen(
                onProgramClick = { programId ->
                    navController.navigate("programs/$programId")
                },
                onNavigateToTemplates = {
                    navController.navigate(Routes.TEMPLATES)
                },
                onNavigateToMeasurements = {
                    navController.navigate(Routes.MEASUREMENTS)
                },
                onNavigateToFood = {
                    navController.navigate(Routes.FOOD)
                },
                onSwitchUser = {
                    navController.navigate(Routes.USER_SELECT) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(
            route = Routes.PROGRAM_DETAIL,
            arguments = listOf(navArgument("programId") { type = NavType.IntType })
        ) { backStackEntry ->
            val programId = backStackEntry.arguments?.getInt("programId") ?: return@composable
            ProgramDetailScreen(
                programId = programId,
                onDayClick = { dayId ->
                    navController.navigate("session/$programId/$dayId")
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.GYM_SESSION,
            arguments = listOf(
                navArgument("programId") { type = NavType.IntType },
                navArgument("dayId") { type = NavType.IntType }
            )
        ) { backStackEntry ->
            val programId = backStackEntry.arguments?.getInt("programId") ?: return@composable
            val dayId = backStackEntry.arguments?.getInt("dayId") ?: return@composable
            GymSessionScreen(
                programId = programId,
                dayId = dayId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.TEMPLATES) {
            TemplatesScreen(
                onTemplateClick = { templateId ->
                    navController.navigate("templates/$templateId")
                },
                onCreateTemplate = {
                    navController.navigate(Routes.TEMPLATE_CREATE)
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.TEMPLATE_DETAIL,
            arguments = listOf(navArgument("templateId") { type = NavType.IntType })
        ) { backStackEntry ->
            val templateId = backStackEntry.arguments?.getInt("templateId") ?: return@composable
            TemplateDetailScreen(
                templateId = templateId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.TEMPLATE_CREATE) {
            TemplateDetailScreen(
                templateId = null,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.MEASUREMENTS) {
            MeasurementsScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.FOOD) {
            FoodScreen(
                onFoodItemClick = { foodItemId ->
                    navController.navigate("food/$foodItemId")
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.FOOD_DETAIL,
            arguments = listOf(navArgument("foodItemId") { type = NavType.IntType })
        ) { backStackEntry ->
            val foodItemId = backStackEntry.arguments?.getInt("foodItemId") ?: return@composable
            FoodDetailScreen(
                foodItemId = foodItemId,
                onBack = { navController.popBackStack() }
            )
        }
    }
}

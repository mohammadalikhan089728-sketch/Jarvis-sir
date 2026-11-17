import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.google.services)
}

val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.mozahid.jarvis"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mozahid.jarvis"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        val proxyUrl = System.getenv("JARVIS_PROXY_BASE_URL")
            ?: localProps.getProperty("JARVIS_PROXY_BASE_URL", "")
        val dbUrl = System.getenv("FIREBASE_DATABASE_URL")
            ?: localProps.getProperty("FIREBASE_DATABASE_URL", "")
        val defaultModel = System.getenv("JARVIS_GEMINI_MODEL")
            ?: localProps.getProperty("JARVIS_GEMINI_MODEL", "gemini-4-hydrogen")

        buildConfigField("String", "JARVIS_PROXY_BASE_URL", "\"$proxyUrl\"")
        buildConfigField("String", "JARVIS_DATABASE_URL", "\"$dbUrl\"")
        buildConfigField("String", "JARVIS_DEFAULT_MODEL", "\"$defaultModel\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.androidx.security.crypto)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth.ktx)
    implementation(libs.firebase.database.ktx)
    implementation(libs.firebase.appcheck.playintegrity)

    implementation(libs.okhttp)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)

    testImplementation(libs.junit)
}

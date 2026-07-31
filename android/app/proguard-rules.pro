# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class com.gymtracker.app.data.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.gymtracker.app.data.model.**$$serializer { *; }
-keepclassmembers class com.gymtracker.app.data.model.** {
    *** Companion;
    *** serializer();
}

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

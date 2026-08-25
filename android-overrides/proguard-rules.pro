# Suzeta — reguli ProGuard/R8 pentru build-ul release.
#
# CRITIC: metodele expuse în WebView prin @JavascriptInterface trebuie păstrate
# cu numele lor exacte, altfel R8 le redenumește și podul de diagnostic
# (SuzetaSignature.getSha1 etc.) întoarce null pentru toate valorile.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep public class app.suzeta.MainActivity { *; }
-keep public class app.suzeta.MainActivity$SignatureBridge { *; }

# Capacitor + pluginuri
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public <methods>;
}

# Credential Manager / Google Identity
-keep class androidx.credentials.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }

# App own package (bridge, plugins, generated classes)
-keep class app.suzeta.** { *; }

# Supabase (Kotlin client, dacă e adăugat vreodată nativ)
-keep class io.github.jan.supabase.** { *; }

# Gson / serializare prin adnotări
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# RevenueCat
-keep class com.revenuecat.purchases.** { *; }

# Social Login (Capgo + community)
-keep class com.getcapacitor.community.sociallogin.** { *; }
-keep class ee.forgr.capacitor.social.login.** { *; }

# Root / tamper detection
-keep class com.scottyab.rootbeer.** { *; }

# Metode native — nu obfusca
-keepclasseswithmembernames class * {
    native <methods>;
}

# Adnotările Capacitor sunt citite prin reflecție la înregistrarea pluginurilor.
# Fără păstrarea lor, R8 le șterge și aplicația crapă la pornire.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, Exceptions
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.capacitorjs.** { *; }
-keep class io.ionic.** { *; }

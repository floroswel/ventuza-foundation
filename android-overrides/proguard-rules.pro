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

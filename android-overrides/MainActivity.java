package app.suzeta;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.InstallSourceInfo;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.JavascriptInterface;

import androidx.core.graphics.Insets;
import androidx.core.view.OnApplyWindowInsetsListener;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

import java.security.MessageDigest;
import java.lang.reflect.Method;
import java.util.ArrayDeque;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * MainActivity override: expune în WebView amprentele semnăturii APK-ului
 * INSTALAT (SHA-1 / SHA-256) ca să putem confirma în panoul de diagnostic
 * dacă build-ul rulat corespunde clientului OAuth Android din Google Cloud.
 *
 * Nu expune nimic sensibil: amprentele certificatului sunt publice prin
 * definiție (oricine poate extrage APK-ul și rula `apksigner verify`).
 */
public class MainActivity extends BridgeActivity {

  private static final int MAX_GOOGLE_LOGS = 40;
  private static final ArrayDeque<String> GOOGLE_LOGS = new ArrayDeque<>();

  /** Apelată de patch-ul CI din GoogleProvider pentru un log relevant, fără token-uri/PII. */
  public static synchronized void recordGoogleDiagnostic(String stage, Throwable error) {
    try {
      JSONObject row = new JSONObject();
      row.put("at", System.currentTimeMillis());
      row.put("stage", stage == null ? "unknown" : stage);
      if (error != null) {
        row.put("exception", error.getClass().getName());
        row.put("message", error.getMessage() == null ? "" : error.getMessage());
        Integer numericCode = numericCode(error);
        if (numericCode != null) row.put("numericCode", numericCode);
        try {
          Method typeMethod = error.getClass().getMethod("getType");
          Object type = typeMethod.invoke(error);
          if (type != null) row.put("credentialType", String.valueOf(type));
        } catch (Throwable ignored) { /* API dependent */ }
        Throwable cause = error.getCause();
        if (cause != null) {
          row.put("cause", cause.getClass().getName()
            + (cause.getMessage() == null ? "" : (": " + cause.getMessage())));
        }
        row.put("stack", stackTrace(error));
      }
      GOOGLE_LOGS.addLast(row.toString());
      while (GOOGLE_LOGS.size() > MAX_GOOGLE_LOGS) GOOGLE_LOGS.removeFirst();
    } catch (Throwable ignored) { /* diagnostic only */ }
  }

  /** Primele 12 frame-uri, fără token-uri (stack trace-ul nu conține date sensibile). */
  private static String stackTrace(Throwable error) {
    StringBuilder sb = new StringBuilder();
    StackTraceElement[] frames = error.getStackTrace();
    int limit = Math.min(frames == null ? 0 : frames.length, 12);
    for (int i = 0; i < limit; i++) {
      if (i > 0) sb.append('\n');
      sb.append("at ").append(frames[i].toString());
    }
    return sb.toString();
  }

  private static Integer numericCode(Throwable error) {
    Throwable current = error;
    while (current != null) {
      for (String methodName : new String[] { "getStatusCode", "getErrorCode" }) {
        try {
          Method method = current.getClass().getMethod(methodName);
          Object value = method.invoke(current);
          if (value instanceof Number) return ((Number) value).intValue();
        } catch (Throwable ignored) { /* try cause/next method */ }
      }
      current = current.getCause();
    }
    return null;
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Securitate: blocăm screenshot-urile și screen recording-ul pe tot
    // conținutul privat (chat, profile, poze). Ecranele publice cer explicit
    // ridicarea flag-ului prin bridge-ul JS `setScreenshotAllowed(true)`.
    getWindow().setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE);

    // Edge-to-edge real: WebView-ul desenează sub status/nav bar, iar noi
    // trimitem insets-urile reale în CSS (--android-inset-top/bottom), pentru
    // că env(safe-area-inset-*) raportează 0 pe multe WebView-uri Android.
    try {
      WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    } catch (Throwable ignored) { /* best effort */ }
    try {
      if (getBridge() != null && getBridge().getWebView() != null) {
        final WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new SignatureBridge(), "SuzetaSignature");

        // ---- WebView security hardening (2.2) ----
        try {
          WebSettings settings = webView.getSettings();
          // Fără acces la fișiere locale (blochează atacurile file://).
          settings.setAllowFileAccess(false);
          settings.setAllowContentAccess(false);
          settings.setAllowFileAccessFromFileURLs(false);
          settings.setAllowUniversalAccessFromFileURLs(false);
          // HTTPS-only: nicio resursă mixed content.
          settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
          // Interfețe JS legacy inutile, expuse istoric de WebView.
          webView.removeJavascriptInterface("searchBoxJavaBridge_");
          webView.removeJavascriptInterface("accessibility");
          webView.removeJavascriptInterface("accessibilityTraversal");
          // Fără cookie-uri third-party în WebView.
          CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        } catch (Throwable ignored) { /* best effort */ }
        ViewCompat.setOnApplyWindowInsetsListener(webView, new OnApplyWindowInsetsListener() {
          @Override
          public WindowInsetsCompat onApplyWindowInsets(View view, WindowInsetsCompat insets) {
            try {
              Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
              float density = view.getResources().getDisplayMetrics().density;
              final int top = Math.round(bars.top / density);
              final int bottom = Math.round(bars.bottom / density);
              final int left = Math.round(bars.left / density);
              final int right = Math.round(bars.right / density);
              final String js =
                "(function(){var s=document.documentElement.style;"
                + "s.setProperty('--android-inset-top','" + top + "px');"
                + "s.setProperty('--android-inset-bottom','" + bottom + "px');"
                + "s.setProperty('--android-inset-left','" + left + "px');"
                + "s.setProperty('--android-inset-right','" + right + "px');"
                + "try{window.dispatchEvent(new CustomEvent('safeareaupdate'));}catch(e){}})();";
              view.post(new Runnable() {
                @Override
                public void run() {
                  try { webView.evaluateJavascript(js, null); } catch (Throwable ignored) { }
                }
              });
            } catch (Throwable ignored) { /* best effort */ }
            // Consumăm insets-urile: layout-ul nativ nu mai adaugă padding pe
            // WebView (altfel înălțimea calculată e greșită și scroll-ul pare blocat).
            return WindowInsetsCompat.CONSUMED;

          }
        });
        ViewCompat.requestApplyInsets(webView);
      }
    } catch (Throwable ignored) {
      // Diagnosticul e best-effort; nu blocăm pornirea aplicației.
    }
  }


  public class SignatureBridge {

    /** Root / Magisk detection (RootBeer). Fail-open la eroare: nu blocăm userii legitimi. */
    @JavascriptInterface
    public boolean isDeviceRooted() {
      try {
        RootBeer rootBeer = new RootBeer(MainActivity.this);
        return rootBeer.isRooted() || rootBeer.checkForMagiskBinary();
      } catch (Throwable ignored) {
        return false;
      }
    }

    /** Emulator detection — semnal de risc pentru anti-fraud, nu blocaj. */
    @JavascriptInterface
    public boolean isRunningOnEmulator() {
      try {
        return (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic"))
          || Build.FINGERPRINT.startsWith("generic")
          || Build.FINGERPRINT.startsWith("unknown")
          || Build.HARDWARE.contains("goldfish")
          || Build.HARDWARE.contains("ranchu")
          || Build.MODEL.contains("google_sdk")
          || Build.MODEL.contains("Emulator")
          || Build.MODEL.contains("Android SDK built for x86")
          || Build.MANUFACTURER.contains("Genymotion")
          || Build.PRODUCT.contains("sdk_google")
          || Build.PRODUCT.contains("google_sdk")
          || Build.PRODUCT.contains("sdk")
          || Build.PRODUCT.contains("sdk_x86")
          || Build.PRODUCT.contains("vbox86p")
          || Build.PRODUCT.contains("emulator")
          || Build.PRODUCT.contains("simulator");
      } catch (Throwable ignored) {
        return false;
      }
    }


    /**
     * Permite/blochează capturile de ecran în funcție de ecranul curent.
     * Default-ul aplicației este BLOCAT (FLAG_SECURE setat în onCreate).
     */
    @JavascriptInterface
    public void setScreenshotAllowed(final boolean allowed) {
      MainActivity.this.runOnUiThread(new Runnable() {
        @Override
        public void run() {
          try {
            if (allowed) {
              getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
              getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE);
            }
          } catch (Throwable ignored) { /* best effort */ }
        }
      });
    }


    /**
     * Toate metadatele într-un singur apel (PackageManager + certificat).
     * Evită situația în care un getter individual eșuează și rămâne null.
     */
    @JavascriptInterface
    public String getAll() {
      JSONObject out = new JSONObject();
      try {
        PackageManager pm = MainActivity.this.getPackageManager();
        String pkg = MainActivity.this.getPackageName();
        out.put("packageName", pkg);
        try {
          PackageInfo info = pm.getPackageInfo(pkg, 0);
          out.put("versionName", info.versionName == null ? "" : info.versionName);
          long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? info.getLongVersionCode()
            : (long) info.versionCode;
          out.put("versionCode", String.valueOf(code));
        } catch (Throwable t) {
          out.put("versionError", String.valueOf(t));
        }
        out.put("installerPackage", getInstallerPackage());
        out.put("installSource", getInstallSource());
        out.put("sha1", digest("SHA-1"));
        out.put("sha256", digest("SHA-256"));
      } catch (Throwable t) {
        try { out.put("error", String.valueOf(t)); } catch (Throwable ignored) { /* noop */ }
      }
      return out.toString();
    }

    @JavascriptInterface
    public String getPackageName() {
      return MainActivity.this.getPackageName();
    }


    @JavascriptInterface
    public String getSha1() {
      return digest("SHA-1");
    }

    @JavascriptInterface
    public String getSha256() {
      return digest("SHA-256");
    }

    @JavascriptInterface
    public String getInstallerPackage() {
      try {
        PackageManager pm = MainActivity.this.getPackageManager();
        String pkg = MainActivity.this.getPackageName();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          InstallSourceInfo source = pm.getInstallSourceInfo(pkg);
          return source.getInstallingPackageName() == null ? "" : source.getInstallingPackageName();
        }
        @SuppressWarnings("deprecation")
        String installer = pm.getInstallerPackageName(pkg);
        return installer == null ? "" : installer;
      } catch (Throwable t) {
        return "";
      }
    }

    @JavascriptInterface
    public String getInstallSource() {
      try {
        String installer = getInstallerPackage();
        if ("com.android.vending".equals(installer)) return "google_play";
        if ("com.google.android.packageinstaller".equals(installer)
            || "com.android.packageinstaller".equals(installer)
            || installer.length() == 0) return "local_or_adb";
        return "other_store";
      } catch (Throwable t) {
        return "unknown";
      }
    }

    @JavascriptInterface
    public String getVersionName() {
      try {
        return MainActivity.this.getPackageManager()
          .getPackageInfo(MainActivity.this.getPackageName(), 0).versionName;
      } catch (Throwable t) {
        return "";
      }
    }

    @JavascriptInterface
    public String getVersionCode() {
      try {
        PackageInfo info = MainActivity.this.getPackageManager()
          .getPackageInfo(MainActivity.this.getPackageName(), 0);
        long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
          ? info.getLongVersionCode()
          : (long) info.versionCode;
        return String.valueOf(code);
      } catch (Throwable t) {
        return "";
      }
    }

    /**
     * Logcat-ul PROPRIULUI proces (Android permite fiecărei aplicații să-și
     * citească propriile linii), filtrat pe tag-urile relevante pentru
     * Credential Manager / Google Sign-In / Supabase Auth.
     */
    @JavascriptInterface
    public String getLogcat() {
      try {
        Process process = Runtime.getRuntime().exec(
          new String[] { "logcat", "-d", "-v", "time", "-t", "400" });
        java.io.BufferedReader reader = new java.io.BufferedReader(
          new java.io.InputStreamReader(process.getInputStream()));
        StringBuilder sb = new StringBuilder();
        String line;
        int kept = 0;
        while ((line = reader.readLine()) != null && kept < 120) {
          String lower = line.toLowerCase();
          if (lower.contains("credentialmanager")
            || lower.contains("credential")
            || lower.contains("googleauth")
            || lower.contains("identity")
            || lower.contains("sociallogin")
            || lower.contains("suzeta")
            || lower.contains("gotrue")
            || lower.contains("supabase")) {
            // Fără token-uri: tăiem orice valoare lungă base64/JWT.
            String safe = line.replaceAll("[A-Za-z0-9_-]{40,}", "[redacted]");
            sb.append(safe).append('\n');
            kept++;
          }
        }
        reader.close();
        return sb.toString();
      } catch (Throwable t) {
        return "";
      }
    }

    @JavascriptInterface
    public String getGoogleDiagnosticLogs() {
      synchronized (MainActivity.class) {
        JSONArray result = new JSONArray();
        for (String item : GOOGLE_LOGS) {
          try { result.put(new JSONObject(item)); } catch (Throwable ignored) { /* skip */ }
        }
        return result.toString();
      }
    }

    private String digest(String algorithm) {
      try {
        PackageManager pm = MainActivity.this.getPackageManager();
        String pkg = MainActivity.this.getPackageName();
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          PackageInfo info = pm.getPackageInfo(pkg, PackageManager.GET_SIGNING_CERTIFICATES);
          signatures = info.signingInfo.hasMultipleSigners()
            ? info.signingInfo.getApkContentsSigners()
            : info.signingInfo.getSigningCertificateHistory();
        } else {
          @SuppressWarnings("deprecation")
          PackageInfo info = pm.getPackageInfo(pkg, PackageManager.GET_SIGNATURES);
          signatures = info.signatures;
        }
        if (signatures == null || signatures.length == 0) return "";
        MessageDigest md = MessageDigest.getInstance(algorithm);
        byte[] hash = md.digest(signatures[0].toByteArray());
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < hash.length; i++) {
          if (i > 0) sb.append(':');
          sb.append(String.format("%02X", hash[i]));
        }
        return sb.toString();
      } catch (Throwable t) {
        return "";
      }
    }
  }
}

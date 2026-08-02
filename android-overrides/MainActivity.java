package app.suzeta;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.InstallSourceInfo;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

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
      }
      GOOGLE_LOGS.addLast(row.toString());
      while (GOOGLE_LOGS.size() > MAX_GOOGLE_LOGS) GOOGLE_LOGS.removeFirst();
    } catch (Throwable ignored) { /* diagnostic only */ }
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
    try {
      if (getBridge() != null && getBridge().getWebView() != null) {
        getBridge().getWebView().addJavascriptInterface(new SignatureBridge(), "SuzetaSignature");
      }
    } catch (Throwable ignored) {
      // Diagnosticul e best-effort; nu blocăm pornirea aplicației.
    }
  }

  public class SignatureBridge {

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

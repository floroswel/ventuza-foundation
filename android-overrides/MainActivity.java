package app.suzeta;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

import java.security.MessageDigest;

/**
 * MainActivity override: expune în WebView amprentele semnăturii APK-ului
 * INSTALAT (SHA-1 / SHA-256) ca să putem confirma în panoul de diagnostic
 * dacă build-ul rulat corespunde clientului OAuth Android din Google Cloud.
 *
 * Nu expune nimic sensibil: amprentele certificatului sunt publice prin
 * definiție (oricine poate extrage APK-ul și rula `apksigner verify`).
 */
public class MainActivity extends BridgeActivity {

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

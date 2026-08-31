package app.suzeta;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Widget home-screen Suzeta (4x1).
 *
 * Reguli de confidențialitate (obligatorii):
 *   - widget-ul NU afișează niciodată conținut de mesaj, nume de useri,
 *     poze, distanțe sau orice dată personală. Doar branding + două acțiuni.
 *   - nu face rețea, nu citește sesiunea, nu are nevoie de permisiuni.
 *
 * Acțiuni:
 *   - „Deschide” → App Link https://suzeta.app/discover (aplicația preia linkul,
 *     web-ul e fallback dacă aplicația a fost dezinstalată).
 *   - „Invită” → ACTION_SEND cu linkul de recomandare (atribuire prin UTM).
 */
public class SuzetaWidgetProvider extends AppWidgetProvider {

    private static final String DISCOVER_URL = "https://suzeta.app/discover?utm_source=android_widget&utm_medium=widget&utm_campaign=widget_open";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    private RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_suzeta);

        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(DISCOVER_URL));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent openPending = PendingIntent.getActivity(
                context, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_discover, openPending);
        views.setOnClickPendingIntent(R.id.widget_icon, openPending);
        views.setOnClickPendingIntent(R.id.widget_title, openPending);

        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType("text/plain");
        share.putExtra(Intent.EXTRA_TEXT, context.getString(R.string.widget_share_text));
        Intent chooser = Intent.createChooser(share, context.getString(R.string.widget_share_title));
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent sharePending = PendingIntent.getActivity(
                context, 2, chooser, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_invite, sharePending);

        return views;
    }

    /** Reîmprospătare programatică (ex. după schimbarea limbii sistemului). */
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, SuzetaWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        if (ids.length == 0) return;
        new SuzetaWidgetProvider().onUpdate(context, manager, ids);
    }
}

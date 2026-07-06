Plan identic cu cel aprobat — mode-ul de build nu s-a activat pe tool-urile de scriere (rejectă cu "plan mode"). Trimite un mesaj scurt („ok" / „execută") ca să deblochezi tranziția.

## Ce execut în prima rundă când intru în build mode

### Sprint 1 — securitate / privacy / cleanup
- **H1 VAPID hardcodat**: elimină `FALLBACK_PRIVATE` din `src/lib/web-push.server.ts`; `sendOne` returnează `{ok:false, gone:false}` cu warn dacă secretul lipsește (nu semnează cu cheie publică în repo).
- **H7 hide_online**: `DiscoverProfile.last_seen: string | null`; `isOnline`/`formatLastSeen` guards pe null → punct verde ascuns când RPC a NULL-uit; guard-uri în `discover.tsx` pe render "Active …".
- **M2 prag online**: unific client la 15 min (paritate RPC `_online_only`).
- **H6 VerificationQueuePanel**: scot nav item + import + state + render din `src/routes/admin.tsx` (deprecated, nu se mai populează).

### Sprint 2 — UX quick wins
- **M1 heartbeat global**: în `SessionGuards`, `supabase.rpc("touch_last_seen")` la mount + la fiecare 2 min cât `document.visibilityState === "visible"` (nu doar la mount discover).
- **M3 Online only toggle**: adaug `<Toggle>` în `FiltersDrawer` alături de Right now / Verified / With photo (câmpul `onlineOnly` există deja în `DiscoverFilters` + storage).

### Skip (necesită acțiuni în afara codului sau scop mare):
- B1-B4 (secrets + `npx cap add android`) — user-side.
- H2/H3/M4 (secrets RevenueCat / Google Play / Lovable).
- H4 og:image — necesită imagine brand generată (separat).
- H5 push la match/tap/woof — mai mare, sprint dedicat (triggere DB → server fn dispatcher).
- M7 Capacitor FCM/APNs — refactor semnificativ.
- M8 (matches badge / sunete distincte / animație), M9 (paginare + grid responsive), M10 (rută publică `/u/$slug`) — sprint UX separat.
- M6 fals-pozitiv: castul din `messages.$id.tsx` e `to: "/verify" as never`, ruta există; nu e problemă.

Diff-urile Sprint 1+2 sunt izolate, non-breaking, tipar identic cu codul existent. Typecheck rulat la final.
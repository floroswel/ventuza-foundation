
# Redesign vizual admin — plan

## Regula de aur (recitită)
**Doar prezentare.** Niciun fișier din `src/lib/admin*.functions.ts`, niciun RPC, niciun trigger, niciun `SENSITIVE_COLUMNS`, niciun gate `is_staff`/`has_role`/`admin_can_access_sensitive` nu se atinge. Dacă o decizie vizuală cere atingerea logicii, mă opresc și revin la tine.

Tot redesign-ul trăiește în:
- `src/components/admin/shell/*` (nou) — `AdminShell`, `AdminSidebar`, `AdminTopbar`, `AdminBreadcrumbs`, `AdminCommandPalette`
- `src/components/admin/ui/*` (nou) — `DataTable`, `Kpi`, `StatusBadge`, `SeverityBadge`, `Art9Badge`, `GlassCard`, `MonoNumber`, `Drawer` wrapper
- `src/routes/admin.tsx` — doar înlocuire layout (taburi → shell + outlet de panou)
- `src/styles.css` — tokens nou (vezi §B)
- panourile existente (`PartnersModerationPanel`, `EnterpriseSections`, `Wave1Sections`, `AdminControlCenter`, etc.) — primesc `DataTable`/`Kpi` în loc de carduri brute, **fără a schimba apelurile către server fn-uri**

## A. Navigare — sidebar vertical grupat

Sidebar colapsabil (shadcn `Sidebar` + `collapsible="icon"`), 5 grupuri:

```text
PREZENTARE
  • Overview          (LayoutDashboard)
  • Alerte            (BellRing)         [badge: alerte active]
  • Analytics         (TrendingUp)

USERI & MODERARE
  • Utilizatori       (Users)            [badge: noi 24h]
  • Rapoarte          (Flag)             [badge: pending]
  • Risc              (ShieldAlert)      [badge: high+]
  • CSAM              (AlertOctagon)     [badge: pending]   — no-render păstrat
  • DSA               (FileWarning)      [badge: pending]   — anonimat păstrat
  • Breșe             (ShieldX)

CONFORMITATE
  • GDPR              (Scale)            [badge: cereri active]
  • Break-glass       (KeyRound)                            — gate super_admin păstrat
  • Audit             (FileSearch)
  • Politici          (BookOpen)
  • Consimțăminte     (CheckCircle2)

BUSINESS
  • Parteneri         (Building2)        [badge: aplicații pending]
  • Ads/Campanii      (Megaphone)
  • B2B               (Briefcase)        [badge: pending]
  • Premium           (Crown)
  • Venituri          (DollarSign)

SISTEM
  • Feature Flags     (ToggleRight)
  • Settings          (Settings)
  • Demo Seed         (Sparkles)                            — gate super_admin păstrat
```

- Badge-urile alimentate din **același** `useAdminPanelLoad` care alimentează deja overview-ul; un singur `useQuery('admin-counters')` care apelează RPC-urile *deja existente* (`admin_get_overview_counts` / agregat existent). Dacă lipsește un contor, badge-ul nu apare — nu adaug RPC nou.
- Grupurile colapsabile (`SidebarGroup` cu `defaultOpen` calculat din ruta curentă).
- Item activ: subliniere amber + glow subtil.
- Permisiuni: itemii care depind de rol (Break-glass = super_admin/auditor, Demo Seed = super_admin) sunt **ascunși vizual** cu hook-ul existent `useAdminRole()` — server-side gate-urile rămân singurele autoritare.

### Topbar
- Breadcrumbs (`Admin / Grup / Modul`)
- Search global (deschide command palette)
- Command palette ⌘K (`cmdk`) — caută printre modulele de mai sus + acțiuni rapide ("Ban user", "Aprobă raport"); fiecare item navighează, nu execută.
- Indicator rol (`super_admin` cu pill amber), idle-timer existent, toggle densitate (`comfortable` / `compact` — schimbă doar `--row-height`).

### Rute
Păstrez ruta unică `/admin` cu state intern `activePanel`. Adaug query param `?panel=users` pentru deep-link + back-button, fără a sparge rutele. Asta nu atinge gate-ul `_authenticated` și nici verificarea de rol din loader.

## B. Estetică — dark glass + amber

Tokens noi în `src/styles.css` (sub `@theme inline`, scoped la `[data-admin]`):

```css
[data-admin] {
  --admin-bg:            oklch(0.16 0.01 60);
  --admin-surface:       oklch(0.20 0.012 60 / 0.72);   /* glass */
  --admin-surface-2:     oklch(0.24 0.014 60 / 0.55);
  --admin-border:        oklch(0.32 0.015 60 / 0.6);
  --admin-text:          oklch(0.96 0.005 60);
  --admin-text-dim:      oklch(0.72 0.01 60);
  --admin-accent:        oklch(0.78 0.14 75);            /* amber */
  --admin-accent-soft:   oklch(0.78 0.14 75 / 0.18);
  --admin-success:       oklch(0.78 0.13 155);
  --admin-warn:          oklch(0.80 0.14 75);
  --admin-danger:        oklch(0.66 0.20 25);
  --admin-art9:          oklch(0.70 0.18 320);           /* fuchsia/magenta — Art.9 */
  --admin-mono: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
  --row-height: 44px;
  --shadow-glass: 0 1px 0 oklch(1 0 0 / 0.06) inset,
                  0 24px 60px -24px oklch(0 0 0 / 0.6);
  backdrop-filter: blur(14px) saturate(140%);
}
[data-admin][data-density="compact"] { --row-height: 32px; }
```

Toate componentele admin (și doar ele) primesc `data-admin` pe shell. Nimeni nu folosește hex hardcodat. Restul aplicației rămâne neatins.

`MonoNumber` aplică `font-variant-numeric: tabular-nums` + `var(--admin-mono)` pentru metrici, ID-uri, timestamps, distanțe — efect "Bloomberg".

Badge-uri:
- `StatusBadge`: pending (amber outline), approved (success), rejected (danger), active (accent fill).
- `SeverityBadge`: low/medium (dim), high (warn), critical (danger + glow).
- `Art9Badge`: pill fuchsia "Art. 9" — marcat distinct pe orientation/HIV/locație, fără să dezvăluie valoarea.

## C. Tabele enterprise (`DataTable`)

Component nou peste `@tanstack/react-table` (deja sub umbrela shadcn) + virtualizare cu `@tanstack/react-virtual` (instalez dacă lipsește). Pentru fiecare panou listă (Utilizatori, Rapoarte, Risc, CSAM, DSA, Breșe, GDPR, Audit, Parteneri, Ads, B2B, Politici, Consimțăminte, Demo Seed):

- coloane configurabile, sortare client-side pe câmpurile deja aduse (nu schimb selectele server)
- search instant pe coloanele safe (display_name, id, action — niciodată pe coloane sensibile)
- filtre per coloană (status, severitate, dată)
- paginare 25/50/100 + virtualizare peste 200 rânduri
- selecție rânduri + bulk actions **doar** pe acțiunile pe care server fn-urile le acceptă deja (ex: bulk-approve raporturi → cheamă în loop server fn-ul existent; nimic nou)
- acțiuni inline (dropdown `MoreHorizontal`) reutilizează handler-ele actuale din panouri
- export CSV pe ce e *deja* afișat în tabel — re-folosesc utilitarul existent din Audit log

Mascarea rămâne sursa adevărului: tabelul randează doar coloanele întoarse de `adminListRows` / panourile dedicate. Dacă o coloană sensibilă nu vine în payload, nu se inventează. Coloanele Art.9 care apar prin break-glass păstrează `Art9Badge` + valoare ascunsă în spatele unui `Reveal` care reapelează RPC-ul existent — fluxul real e neatins.

## D. Overview — dashboard real

Înlocuiește grila actuală de carduri uriașe cu:

1. **Bandă KPI** compactă (8 metrici, fiecare 1/8 lățime): DAU, WAU, MAU, useri noi 24h, rapoarte pending, GDPR cereri active, breșe deschise, MRR partener. Numerele `MonoNumber`, delta vs. ieri în verde/roșu. **Toate vin din `admin_analytics_summary` deja existent.**
2. **Grafic principal** (recharts existent): useri activi 30 zile + suprapunere rapoarte/zi.
3. **Coloana "Necesită atenție"** (dreapta): listă scurtă de inbox-uri (Rapoarte deschise, B2B pending, GDPR cereri, Breșe), fiecare cu count + buton "Deschide modulul" care setează `activePanel`.
4. **Live refresh** existent păstrat 1:1 (același `setInterval` din `AdminControlCenter`).

## E. Drawer pattern extins

Drawer-ul de user detail (`Wave1Sections`) e reper. Extrag containerul în `<AdminDetailDrawer>` și îl folosesc pentru:
- Partener detail (înlocuiește panoul plat actual)
- Raport detail (DSA / user reports)
- B2B aplicație detail
- Campanie ad detail
- Audit entry detail

Structura drawer-ului: header (titlu + status + Art.9 badge dacă e cazul), tab-uri interne (Profil / Acțiuni / Audit / Consimțăminte / Break-glass), footer cu acțiunile primare. Toate acțiunile = handler-ele server fn deja folosite în panouri.

## F. Responsive & polish

- Sidebar `collapsible="icon"` automat pe `<lg` cu `SidebarTrigger` în topbar.
- DataTable: pe `<md` coloanele secundare se ascund (configurate prin `meta.priority`).
- Loading / error / empty: păstrez `PanelStatus` + `useAdminPanelLoad` (regula din AGENTS.md). Doar restilizate cu noile tokens.
- Tranziții: `transition-colors duration-150` pe rânduri/butoane. Fără spring/parallax. Drawer slide 180 ms.

## Ce NU se atinge (checklist înainte de PR)
- [ ] `src/lib/admin-*.functions.ts` — zero diff
- [ ] `src/integrations/supabase/*` — zero diff
- [ ] SQL / migrații — zero diff
- [ ] `SENSITIVE_COLUMNS`, `safeColumnsFor`, `adminBreakGlassReveal`, `admin_can_access_sensitive` — zero diff
- [ ] `AgeGate`, regulile din AGENTS.md — neatinse
- [ ] CSAM: niciun `<img src={photo_url}>`. DSA: `reporter_*` rămâne strip. Orientation/HIV/location: doar prin break-glass existent.

## Detalii tehnice

- Pachete noi (dacă lipsesc): `cmdk` (command palette), `@tanstack/react-table`, `@tanstack/react-virtual`. Verific întâi cu `rg`, instalez doar diferența.
- Migrare modul cu modul, în 3 sub-livrări pe care le bifez singur fără confirmare între ele:
  1. Shell (sidebar + topbar + command palette + tokens + `data-admin`) și mutarea taburilor existente neschimbate sub el — nimic nu se sparge.
  2. `DataTable` + `Kpi` + `StatusBadge` etc., re-cablate pe panourile listă în ordine: Utilizatori → Rapoarte → Parteneri → Ads → GDPR → Audit → restul.
  3. Overview real + drawer pattern extins.
- La final: screenshot via Playwright pe `/admin` cu 3 panouri principale (Overview, Utilizatori, Rapoarte) ca dovadă vizuală + verificare în consolă că nu apar erori noi.

## Risc identificat (vreau confirmarea ta)
Un singur loc unde aș putea atinge logica fără să vreau: **badge-urile de contoare din sidebar**. Dacă nu există deja un RPC agregat care întoarce toate count-urile (rapoarte pending, B2B pending, GDPR active, breșe deschise) într-un apel, am două opțiuni curate:
- (a) cheamă în paralel RPC-urile existente per modul (mai multe round-trips, zero cod nou pe server),
- (b) adaug un view/RPC nou `admin_sidebar_counters` (SECURITY DEFINER, gate `is_staff`) — asta ar fi singura schimbare de logică.

**Default-ul meu: (a).** Confirmă sau spune-mi să fac (b).

---

Pe scurt: shell nou + tokens + tabele + drawer pattern, panourile existente îmbrăcate în uniformă nouă, zero atingere a securității. Confirmă și pornesc.

# Backup & Restore Procedure — Ventuza (Supabase)

**Versiune:** 1.0.0
**Data:** 2026-07-13
**Owner:** Florin (Administrator)

---

## 1. Strategie

Supabase Cloud oferă două paliere de backup, în funcție de plan:

| Plan | Backup automat | PITR | Retenție |
|------|----------------|------|----------|
| Free | Daily snapshot | ❌ | 7 zile |
| Pro | Daily snapshot | ✅ (7 zile) | 7 zile snapshot + 7 zile PITR |
| Team | Daily snapshot | ✅ (14 zile) | 14 zile snapshot + 14 zile PITR |
| Enterprise | Daily + custom | ✅ (28 zile+) | negociabil |

**Recomandare Ventuza:** minimum Pro (25$/mo) pentru PITR — la un breach sau
o migrare greșită, PITR permite restore la secundă exactă.

**Plus:** backup OFFLINE săptămânal cu `pg_dump` stocat în storage third-party
(Cloudflare R2 / Backblaze B2) — protecție contra "vendor lock" și scenarii
catastrofice (contul Supabase suspendat, factură neplătită etc.).

---

## 2. Backup zilnic (automat — Supabase)

Nimic de făcut manual. Supabase face snapshot zilnic în background.

**Verificare periodică (lunar):**
1. Dashboard Supabase → Project → Database → Backups
2. Confirmă că ultima entry este ≤ 24h.
3. Dacă lipsește: escaladează la Supabase support.

---

## 3. Backup OFFLINE săptămânal (manual)

### 3.1 Prerequisite

- `pg_dump` versiunea 16+ (compatibil cu Postgres 15/16 Supabase).
- Credentials DB read-only (creează un rol dedicat `backup_ro`):

```sql
-- Rulează O SINGURĂ DATĂ, ca super_admin în SQL Editor:
CREATE ROLE backup_ro WITH LOGIN PASSWORD '<strong-random-32-chars>';
GRANT USAGE ON SCHEMA public TO backup_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_ro;
-- BYPASSRLS ca să dump-uiască toate rândurile
ALTER ROLE backup_ro BYPASSRLS;
```

Stochează parola în password manager, NU în repo.

### 3.2 Comandă backup

```bash
# Variabile (setează local, NU în repo)
export PGPASSWORD='<parola-backup_ro>'
export SUPABASE_HOST='db.szzxhvvmwqvfyoldcuyz.supabase.co'
export BACKUP_DIR="$HOME/ventuza-backups"
mkdir -p "$BACKUP_DIR"
TS=$(date -u +%Y%m%d-%H%M%S)

pg_dump \
  --host="$SUPABASE_HOST" \
  --port=5432 \
  --username=backup_ro \
  --dbname=postgres \
  --schema=public \
  --no-owner \
  --no-privileges \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_DIR/ventuza-$TS.dump"

# Verifică dimensiunea (>1MB pentru bază populată)
ls -lh "$BACKUP_DIR/ventuza-$TS.dump"

# Cifrare cu age (installează cu: brew install age / apt install age)
age -r 'age1<public-key>' \
    -o "$BACKUP_DIR/ventuza-$TS.dump.age" \
    "$BACKUP_DIR/ventuza-$TS.dump"

# Șterge originalul necifrat
rm "$BACKUP_DIR/ventuza-$TS.dump"

# Upload la Cloudflare R2 (sau alt storage)
rclone copy "$BACKUP_DIR/ventuza-$TS.dump.age" r2:ventuza-backups/
```

### 3.3 Storage backup

- **Cloudflare R2**: bucket privat `ventuza-backups`, retenție 90 zile, lifecycle
  policy → Standard 30d, Infrequent Access 60d, delete la 90d.
- **Cheia age** (publică — pentru cifrare) în repo la `docs/backup-public-key.txt`.
- **Cheia age privată** (pentru decriptare) în password manager Florin + copie
  offline (USB encrypted safe).

### 3.4 Automatizare (opțional)

Cron pe machine personal Florin (rulează săptămânal duminică 3AM UTC):

```bash
0 3 * * 0 /home/florin/scripts/ventuza-backup.sh >> /var/log/ventuza-backup.log 2>&1
```

Script complet: vezi Appendix A la finalul acestui doc.

---

## 4. Restore — procedură testată

### 4.1 Scenariu 1: Restore complet Supabase (PITR)

**Când:** migrare greșită, ștergere accidentală massa, corruption.

1. Dashboard Supabase → Database → Backups → **Point in time recovery**.
2. Alege timestamp EXACT înaintea incidentului.
3. Confirmă (⚠️ overwrite complet — nu există undo).
4. Aplicația reconectează automat (URL neschimbat).
5. Verifică sanity checks:
   ```sql
   SELECT count(*) FROM public.profiles;
   SELECT max(created_at) FROM public.messages;
   SELECT count(*) FROM public.admin_audit_log WHERE created_at > now() - interval '1 hour';
   ```

**Timp estimat:** 5-15 min pentru DB medii (< 10GB).

### 4.2 Scenariu 2: Restore parțial din pg_dump

**Când:** un tabel corupt, dar restul DB e OK.

```bash
# Decifrează
age -d -i ~/.age/ventuza-backup-key.txt \
    -o /tmp/ventuza-restore.dump \
    /path/to/ventuza-YYYYMMDD-HHMMSS.dump.age

# Restore doar o tabelă (ex: profiles)
pg_restore \
  --host=db.szzxhvvmwqvfyoldcuyz.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --table=profiles \
  --data-only \
  --disable-triggers \
  /tmp/ventuza-restore.dump

# Curățare
shred -u /tmp/ventuza-restore.dump
```

⚠️ `--data-only` presupune schema există. Pentru schema recuperare, folosește
`--schema-only`.

### 4.3 Scenariu 3: Restore catastrofic într-un proiect Supabase NOU

**Când:** contul Supabase blocat / vendor lock scenario.

1. Creează proiect Supabase nou.
2. Rulează toate migrările din `supabase/migrations/` în ordine:
   ```bash
   for f in supabase/migrations/*.sql; do
     psql "$NEW_DB_URL" -f "$f"
   done
   ```
3. Restore date din pg_dump cifrat:
   ```bash
   age -d -i ~/.age/key.txt -o /tmp/restore.dump backup.dump.age
   pg_restore --host=<new-host> --dbname=postgres --data-only /tmp/restore.dump
   shred -u /tmp/restore.dump
   ```
4. Actualizează `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` în GitHub
   Secrets.
5. Redeploy.

**Timp estimat:** 2-4 ore.

---

## 5. Test de restore documentat

**Ultimul test executat:** — (necesar înainte de go-live prod).

**Procedură test (rulează trimestrial):**

1. Creează proiect Supabase test (free tier).
2. Aplică migrări în ordine.
3. Restore ultimul pg_dump săptămânal.
4. Sanity checks:
   ```sql
   -- Count rows per tabelă importantă
   SELECT 'profiles' AS t, count(*) FROM profiles UNION ALL
   SELECT 'messages', count(*) FROM messages UNION ALL
   SELECT 'matches', count(*) FROM matches UNION ALL
   SELECT 'admin_audit_log', count(*) FROM admin_audit_log;

   -- Verifică integritate FK
   SELECT constraint_name FROM information_schema.constraint_column_usage
   WHERE table_schema = 'public' LIMIT 5;

   -- Verifică cifrarea HIV intactă
   SELECT count(*) FROM profiles WHERE hiv_status_enc IS NOT NULL;
   ```
5. Documentează rezultat în `docs/backup-tests/YYYY-MM-DD.md`.
6. Șterge proiectul test (nu lăsa date user într-un mediu paralel).

---

## Appendix A: Script backup complet

Salvează ca `~/scripts/ventuza-backup.sh` + `chmod +x`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Config — completează
export PGPASSWORD='<parola-backup_ro>'
SUPABASE_HOST='db.szzxhvvmwqvfyoldcuyz.supabase.co'
BACKUP_DIR="$HOME/ventuza-backups"
AGE_RECIPIENT='age1<public-key>'
R2_REMOTE='r2:ventuza-backups'
RETENTION_LOCAL_DAYS=14

mkdir -p "$BACKUP_DIR"
TS=$(date -u +%Y%m%d-%H%M%S)
DUMP="$BACKUP_DIR/ventuza-$TS.dump"
ENC="$DUMP.age"

echo "[$(date -u -Iseconds)] Backup started"

pg_dump \
  --host="$SUPABASE_HOST" \
  --port=5432 \
  --username=backup_ro \
  --dbname=postgres \
  --schema=public \
  --no-owner \
  --no-privileges \
  --format=custom \
  --compress=9 \
  --file="$DUMP"

SIZE=$(stat -c%s "$DUMP")
if [ "$SIZE" -lt 1000000 ]; then
  echo "ERROR: dump size $SIZE bytes < 1MB — abort" >&2
  exit 1
fi

age -r "$AGE_RECIPIENT" -o "$ENC" "$DUMP"
rm "$DUMP"

rclone copy "$ENC" "$R2_REMOTE"

find "$BACKUP_DIR" -name '*.dump.age' -mtime "+$RETENTION_LOCAL_DAYS" -delete

echo "[$(date -u -Iseconds)] Backup OK ($ENC, $SIZE bytes)"
```

---

## Contact suport

- Supabase support: support@supabase.com (SLA după plan)
- Consultant GDPR: [contactele din agenda personală, nu în repo]

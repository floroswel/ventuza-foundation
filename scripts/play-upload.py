#!/usr/bin/env python3
"""
Upload AAB în Google Play (Android Publisher v3) cu erori LIZIBILE.

Înlocuiește `r0adkll/upload-google-play`, care raporta doar
"Error: Unknown error occurred." fără niciun detaliu. Aici fiecare apel HTTP
eșuat afișează status + corpul răspunsului Google, deci cauza reală
(permisiuni, versionCode duplicat, status invalid, track inexistent) e vizibilă.

Env:
  PLAY_SERVICE_ACCOUNT_JSON  (obligatoriu)
  PLAY_PACKAGE_NAME          (default app.suzeta)
  PLAY_AAB                   cale către .aab
  PLAY_TRACK                 internal|alpha|beta|production
  PLAY_STATUS                draft|completed|inProgress|halted
  PLAY_USER_FRACTION         opțional (0..1) pentru inProgress
  PLAY_WHATSNEW_DIR          director cu fișiere whatsnew-<locale>
  PLAY_MAPPING               opțional, mapping.txt R8
"""

import json
import os
import sys

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

VALID_STATUS = {"draft", "completed", "inProgress", "halted"}
VALID_TRACKS = {"internal", "alpha", "beta", "production"}
BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications"


def fail(msg: str) -> "None":
    print(f"::error::{msg}")
    sys.exit(1)


def check(resp, what: str):
    if resp.status_code >= 300:
        fail(f"{what} a eșuat: HTTP {resp.status_code}\n{resp.text[:1500]}")
    return resp


def main() -> None:
    raw = os.environ.get("PLAY_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        fail("PLAY_SERVICE_ACCOUNT_JSON lipsește din secretele repo-ului.")
    try:
        info = json.loads(raw)
    except json.JSONDecodeError as exc:
        fail(f"PLAY_SERVICE_ACCOUNT_JSON nu e JSON valid: {exc}")

    pkg = os.environ.get("PLAY_PACKAGE_NAME") or "app.suzeta"
    aab = os.environ.get("PLAY_AAB") or ""
    track = (os.environ.get("PLAY_TRACK") or "internal").strip()
    status = (os.environ.get("PLAY_STATUS") or "completed").strip()
    fraction = (os.environ.get("PLAY_USER_FRACTION") or "").strip()
    whatsnew_dir = os.environ.get("PLAY_WHATSNEW_DIR") or ""
    mapping = (os.environ.get("PLAY_MAPPING") or "").strip()

    if not os.path.isfile(aab):
        fail(f"AAB-ul nu există la calea '{aab}'.")
    if track not in VALID_TRACKS:
        fail(f"Track invalid '{track}'. Permise: {sorted(VALID_TRACKS)}")
    if status not in VALID_STATUS:
        fail(
            f"Status invalid '{status}'. Google acceptă doar {sorted(VALID_STATUS)} "
            "(verifică `status` din release/version.json)."
        )
    if status == "inProgress" and not fraction:
        fraction = "0.05"

    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/androidpublisher"]
    )
    creds.refresh(Request())
    auth = {"Authorization": f"Bearer {creds.token}"}

    edit = check(
        requests.post(f"{BASE}/{pkg}/edits", headers=auth, timeout=120),
        "Deschiderea unui edit în Play (verifică accesul service account-ului la "
        f"{pkg} și că Android Publisher API e activat)",
    ).json()
    eid = edit["id"]
    print(f"✓ edit deschis: {eid}")

    with open(aab, "rb") as fh:
        up = check(
            requests.post(
                f"{UPLOAD}/{pkg}/edits/{eid}/bundles?uploadType=media",
                headers={**auth, "Content-Type": "application/octet-stream"},
                data=fh,
                timeout=1800,
            ),
            "Uploadul AAB",
        ).json()
    version_code = int(up["versionCode"])
    print(f"✓ AAB urcat, versionCode={version_code}")

    if mapping and os.path.isfile(mapping) and os.path.getsize(mapping) > 0:
        with open(mapping, "rb") as fh:
            check(
                requests.post(
                    f"{UPLOAD}/{pkg}/edits/{eid}/bundles/{version_code}/deobfuscationFiles/proguard"
                    "?uploadType=media",
                    headers={**auth, "Content-Type": "application/octet-stream"},
                    data=fh,
                    timeout=600,
                ),
                "Uploadul mapping.txt",
            )
        print("✓ mapping.txt urcat")

    notes = []
    if whatsnew_dir and os.path.isdir(whatsnew_dir):
        for name in sorted(os.listdir(whatsnew_dir)):
            if not name.startswith("whatsnew-"):
                continue
            lang = name[len("whatsnew-") :]
            text = open(os.path.join(whatsnew_dir, name), encoding="utf-8").read().strip()[:490]
            if text:
                notes.append({"language": lang, "text": text})
    print(f"Release notes: {[n['language'] for n in notes] or 'niciunul'}")

    release = {"versionCodes": [str(version_code)], "status": status}
    if status == "inProgress":
        release["userFraction"] = float(fraction)
    if notes:
        release["releaseNotes"] = notes

    check(
        requests.put(
            f"{BASE}/{pkg}/edits/{eid}/tracks/{track}",
            headers={**auth, "Content-Type": "application/json"},
            data=json.dumps({"track": track, "releases": [release]}),
            timeout=300,
        ),
        f"Setarea track-ului '{track}'",
    )
    print(f"✓ track '{track}' actualizat (status={status})")

    check(
        requests.post(f"{BASE}/{pkg}/edits/{eid}:commit", headers=auth, timeout=600),
        "Commit-ul edit-ului",
    )
    print(f"✅ Publicat: {pkg} build {version_code} pe track '{track}' (status {status}).")

    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(
                f"\n### Google Play\n- pachet: `{pkg}`\n- versionCode: **{version_code}**\n"
                f"- track: **{track}**\n- status: **{status}**\n"
            )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generează PDF-ul descărcabil pentru /legal/dpa din docs/legal/dpa-source.md.

Utilizare:
    python3 scripts/build-dpa-pdf.py --version 1.0 --date "25 august 2026"

Rezultat: public/legal/dpa-v<version>.pdf

După generare, adaugă versiunea în `DPA_VERSIONS` din src/lib/legal-versions.ts
(cu `current: true`) și pune `current: false` pe versiunea anterioară.
"""

import argparse
import re
import subprocess
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs" / "legal" / "dpa-source.md"
OUT_DIR = ROOT / "public" / "legal"


def register_fonts() -> tuple[str, str]:
    regular = subprocess.check_output(
        ["fc-match", "-f", "%{file}", "DejaVu Sans"], text=True
    ).strip()
    bold = subprocess.check_output(
        ["fc-match", "-f", "%{file}", "DejaVu Sans:bold"], text=True
    ).strip()
    pdfmetrics.registerFont(TTFont("DejaVuSans", regular))
    pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", bold))
    return "DejaVuSans", "DejaVuSans-Bold"


def escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build(version: str, date: str) -> Path:
    body, bold = register_fonts()
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DpaTitle", parent=styles["Title"], fontName=bold, fontSize=18, leading=22, spaceAfter=6
    )
    meta_style = ParagraphStyle(
        "DpaMeta", parent=styles["Normal"], fontName=body, fontSize=9, textColor="#555555"
    )
    h2_style = ParagraphStyle(
        "DpaH2", parent=styles["Heading2"], fontName=bold, fontSize=12, leading=15,
        spaceBefore=12, spaceAfter=4,
    )
    p_style = ParagraphStyle(
        "DpaBody", parent=styles["Normal"], fontName=body, fontSize=9.5, leading=13.5, spaceAfter=6
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"dpa-v{version}.pdf"

    doc = SimpleDocTemplate(
        str(out),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Acord de prelucrare a datelor (DPA) v{version} — Suzeta",
        author="VOMIX GENIUS S.R.L.",
        subject="DPA Art. 28 GDPR",
    )

    flow = []
    bullets: list[str] = []

    def flush_bullets():
        nonlocal bullets
        if bullets:
            flow.append(
                ListFlowable(
                    [ListItem(Paragraph(escape(b), p_style), leftIndent=10) for b in bullets],
                    bulletType="bullet",
                    start="•",
                    leftIndent=12,
                )
            )
            flow.append(Spacer(1, 4))
            bullets = []

    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            flush_bullets()
            continue
        if line.startswith("# "):
            flush_bullets()
            flow.append(Paragraph(escape(line[2:]), title_style))
        elif line.startswith("## "):
            flush_bullets()
            flow.append(Paragraph(escape(line[3:]), h2_style))
        elif line.startswith("- "):
            bullets.append(line[2:])
        else:
            flush_bullets()
            text = escape(line)
            # Meta lines right under the title
            if re.match(r"^(Versiunea |VOMIX GENIUS)", line):
                flow.append(Paragraph(text, meta_style))
            else:
                flow.append(Paragraph(text, p_style))
    flush_bullets()

    flow.append(Spacer(1, 10))
    flow.append(
        Paragraph(
            escape(
                f"Document generat automat din docs/legal/dpa-source.md · versiunea {version} · {date} · "
                "versiunea online autoritativă: https://suzeta.ro/legal/dpa"
            ),
            meta_style,
        )
    )

    doc.build(flow)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="1.0")
    ap.add_argument("--date", default="25 august 2026")
    args = ap.parse_args()
    path = build(args.version, args.date)
    print(f"PDF scris în {path}")

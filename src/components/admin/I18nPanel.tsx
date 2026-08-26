/**
 * Panou admin „Traduceri”.
 *
 * - raport de acoperire per limbă (chei lipsă / căzute pe engleză / orfane)
 *   + acoperirea etichetelor din onboarding (gen, pronume, orientare etc.);
 * - export dicționare ca fișier JSON editabil;
 * - import înapoi → salvat în `app_settings.i18n_overrides`, aplicat la
 *   runtime în toată aplicația, fără build nou.
 *
 * Stări obligatorii: loading / error (cu retry) / empty legitim.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, RefreshCw, Languages, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_LANGUAGES, RESOURCES, type AppLanguage } from "@/locales";
import {
  buildBundle,
  bundleToOverrides,
  computeCoverage,
  coverageMarkdown,
  parseBundle,
  type NestedDict,
} from "@/lib/i18n/dictionary-io";
import { optionLabelCoverage } from "@/lib/i18n/option-labels";
import { I18N_OVERRIDES_SETTING_KEY, loadI18nOverrides } from "@/lib/i18n/overrides";
import { adminUpdateSetting } from "@/lib/admin-settings.functions";

const SHIPPED = Object.fromEntries(
  Object.entries(RESOURCES).map(([code, r]) => [code, r.translation as NestedDict]),
) as Record<string, NestedDict>;

const LANG_CODES = APP_LANGUAGES.map((l) => l.code);

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function I18nPanel() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideCount, setOverrideCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(
    () => computeCoverage(SHIPPED.en!, SHIPPED, { referenceLanguage: "en" }),
    [],
  );
  const optionRows = useMemo(() => optionLabelCoverage(LANG_CODES as AppLanguage[]), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error: err } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", I18N_OVERRIDES_SETTING_KEY)
        .maybeSingle();
      if (err) throw err;
      const value = (data?.value ?? null) as Record<string, Record<string, string>> | null;
      setOverrideCount(
        value ? Object.values(value).reduce((n, d) => n + Object.keys(d ?? {}).length, 0) : 0,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onExport = () => {
    const bundle = buildBundle(SHIPPED);
    download(
      `suzeta-traduceri-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(bundle, null, 2),
      "application/json",
    );
  };

  const onExportReport = () => {
    let md = coverageMarkdown(rows, "Acoperire traduceri — ecrane");
    md += "\n# Etichete opțiuni (onboarding & profil)\n\n| Limbă | Acoperire | Lipsă |\n| --- | --- | --- |\n";
    for (const o of optionRows) {
      md += `| ${o.locale} | ${o.percent}% (${o.translated}/${o.total}) | ${o.missing.length} |\n`;
    }
    download(`suzeta-raport-traduceri-${new Date().toISOString().slice(0, 10)}.md`, md, "text/markdown");
  };

  const onImport = async (file: File) => {
    setSaving(true);
    setError(null);
    try {
      const bundle = parseBundle(JSON.parse(await file.text()), LANG_CODES);
      const overrides = bundleToOverrides(bundle, SHIPPED);
      const changed = Object.values(overrides).reduce((n, d) => n + Object.keys(d).length, 0);
      await adminUpdateSetting({
        data: {
          key: I18N_OVERRIDES_SETTING_KEY,
          value: overrides as unknown as Record<string, unknown>,
          reason: `Import dicționare: ${changed} chei modificate`,
        },
      });
      await loadI18nOverrides();
      setOverrideCount(changed);
      toast.success(`Traduceri actualizate: ${changed} chei aplicate live.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Languages className="h-4 w-4" /> Traduceri
            </h3>
            <p className="text-sm text-muted-foreground">
              Export / import dicționare fără build nou. Cheile importate se aplică peste textele
              din aplicație imediat ce salvezi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-1.5 h-4 w-4" /> Export dicționare
            </Button>
            <Button variant="outline" size="sm" onClick={onExportReport}>
              <FileText className="mr-1.5 h-4 w-4" /> Export raport
            </Button>
            <Button size="sm" disabled={saving} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" /> {saving ? "Se salvează…" : "Import"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
              }}
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive">
              {/forbidden|denied|rol|role|policy|permission/i.test(error)
                ? "Acces refuzat — este necesar rolul super_admin."
                : "Eroare"}
            </p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => void load()}>
              Reîncearcă
            </Button>
          </div>
        )}

        {!error && !loading && (
          <p className="mt-3 text-sm text-muted-foreground">
            {overrideCount === 0
              ? "Nicio suprascriere activă (empty legitim) — se folosesc textele din build."
              : `${overrideCount} chei suprascrise din admin.`}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h4 className="mb-3 text-sm font-semibold">Acoperire ecrane (referință: engleza)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-3">Limbă</th>
                <th className="py-1 pr-3">Acoperire</th>
                <th className="py-1 pr-3">Lipsă</th>
                <th className="py-1 pr-3">Căzute pe EN</th>
                <th className="py-1">Orfane</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.language} className="border-t border-border/50">
                  <td className="py-1.5 pr-3 font-medium">{r.language}</td>
                  <td className="py-1.5 pr-3">
                    <Badge variant={r.percent > 90 ? "default" : "secondary"}>{r.percent}%</Badge>
                  </td>
                  <td className="py-1.5 pr-3">{r.missing.length}</td>
                  <td className="py-1.5 pr-3">{r.sameAsEnglish.length}</td>
                  <td className="py-1.5">{r.orphan.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="mb-3 text-sm font-semibold">
          Acoperire etichete onboarding (gen, pronume, orientare, ce caut, interese)
        </h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {optionRows.map((o) => (
            <div
              key={o.locale}
              className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm"
            >
              <span className="font-medium">{o.locale}</span>
              <span className="text-muted-foreground">
                {o.percent}% · lipsă {o.missing.length}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

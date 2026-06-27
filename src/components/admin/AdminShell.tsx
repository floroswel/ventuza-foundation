import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Crown, Search, Command as CmdIcon, Activity, Circle, ChevronLeft, Rows3, Rows4,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  hint?: string;
  badge?: number | string;
  hidden?: boolean;
};

type Props = {
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
  roleLabel: string;
  children: ReactNode;
  banner?: ReactNode;
};

const GROUP_ORDER = ["Operations", "Trust & Safety", "Compliance", "Business", "System"];

export function AdminShell({ items, active, onSelect, roleLabel, children, banner }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [density, setDensity] = useState<"comfortable" | "compact">(() => {
    if (typeof window === "undefined") return "comfortable";
    return (localStorage.getItem("admin:density") as "comfortable" | "compact") ?? "comfortable";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("admin:density", density);
  }, [density]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = items.filter((i) => !i.hidden);
  const grouped = useMemo(() => {
    const g: Record<string, NavItem[]> = {};
    for (const it of visible) (g[it.group] ??= []).push(it);
    return GROUP_ORDER.filter((k) => g[k]?.length).map((k) => [k, g[k]!] as const);
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((i) =>
      i.label.toLowerCase().includes(q) ||
      i.group.toLowerCase().includes(q) ||
      (i.hint ?? "").toLowerCase().includes(q),
    );
  }, [query, visible]);

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      {/* Ambient backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.82_0.115_85/0.18),transparent_70%)] blur-2xl" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[600px] rounded-full bg-[radial-gradient(closest-side,oklch(0.62_0.18_25/0.10),transparent_70%)] blur-2xl" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(0.95 0.015 85 / 0.4) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.95 0.015 85 / 0.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`sticky top-0 z-30 hidden h-dvh shrink-0 border-r border-border/60 bg-surface/40 backdrop-blur-xl md:flex md:flex-col transition-[width] duration-200 ${
            collapsed ? "w-[68px]" : "w-[248px]"
          }`}
        >
          <div className="flex items-center gap-2 px-4 py-4">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[oklch(0.82_0.115_85)] to-[oklch(0.62_0.14_50)] shadow-[0_0_24px_oklch(0.82_0.115_85/0.45)]">
              <Crown className="size-4 text-[oklch(0.16_0.012_70)]" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight">Ventuza Control</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80">Command Deck</p>
              </div>
            )}
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <ChevronLeft className={`size-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-none">
            {grouped.map(([group, list]) => (
              <div key={group} className="mb-3">
                {!collapsed && (
                  <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                    {group}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {list.map((it) => {
                    const isActive = active === it.id;
                    const Icon = it.icon;
                    return (
                      <li key={it.id}>
                        <button
                          onClick={() => onSelect(it.id)}
                          title={collapsed ? it.label : undefined}
                          className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
                            isActive
                              ? "bg-primary/15 text-foreground"
                              : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                          }`}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_10px_oklch(0.82_0.115_85/0.7)]" />
                          )}
                          <Icon className={`size-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                          {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                          {!collapsed && it.badge != null && (
                            <span className="ml-auto rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              {it.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {!collapsed && (
            <div className="border-t border-border/60 px-3 py-3 text-[10px] text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <Circle className="size-2 animate-pulse fill-emerald-400 text-emerald-400" />
                Sistem online · idle-out 15m
              </p>
            </div>
          )}
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                onClick={() => setPaletteOpen(true)}
                className="group flex flex-1 items-center gap-2 rounded-xl border border-border/60 bg-surface/60 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-surface md:max-w-md"
              >
                <Search className="size-4" />
                <span className="flex-1 truncate">Caută modul, acțiune, user…</span>
                <kbd className="hidden items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground md:inline-flex">
                  <CmdIcon className="size-3" />K
                </kbd>
              </button>

              <div className="ml-auto hidden items-center gap-3 lg:flex">
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1.5 text-xs text-muted-foreground">
                  <Activity className="size-3.5 text-emerald-400" />
                  <span className="font-mono">{now.toLocaleTimeString("ro-RO")}</span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  <Circle className="size-2 animate-pulse fill-primary text-primary" />
                  {roleLabel}
                </div>
              </div>
            </div>

            {/* Mobile group pill nav */}
            <div className="md:hidden">
              <div className="flex gap-1 overflow-x-auto px-3 pb-2 scrollbar-none">
                {visible.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => onSelect(it.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      active === it.id
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-surface/40 text-muted-foreground"
                    }`}
                  >
                    <it.icon className="size-3.5" />
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {banner}

          <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>

      {/* Command palette */}
      {paletteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 px-4 pt-[12vh] backdrop-blur-md"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-primary/30 bg-surface/95 shadow-[0_30px_120px_-20px_oklch(0.82_0.115_85/0.35)]"
          >
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Comandă… (ex: rapoarte, GDPR, parteneri)"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">ESC</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">Niciun rezultat.</li>
              )}
              {filtered.map((it) => (
                <li key={it.id}>
                  <button
                    onClick={() => {
                      onSelect(it.id);
                      setPaletteOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-primary/10"
                  >
                    <it.icon className="size-4 text-primary" />
                    <span className="flex-1 truncate">{it.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.group}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

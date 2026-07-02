import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  Command as CmdIcon,
  ArrowRight,
  User as UserIcon,
  Hash,
  ShieldAlert,
  Ban,
  Zap,
  LayoutDashboard,
  CornerDownLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { adminSearchUsers } from "@/lib/admin.functions";
import type { NavItem } from "./AdminShell";

type Entity = {
  id: string;
  kind: "user";
  title: string;
  subtitle: string;
  badges: string[];
  target: string;
};

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  perform: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  onSelectNav: (id: string) => void;
};

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export function CommandPaletteV2({ open, onClose, items, onSelectNav }: Props) {
  const nav = useNavigate();
  const search = useServerFn(adminSearchUsers);
  const [q, setQ] = useState("");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setEntities([]);
      setCursor(0);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  // Debounced entity search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const query = q.trim();
    if (query.length < 2) {
      setEntities([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = (await search({ data: { q: query, limit: 8 } })) as any[];
        setEntities(
          (rows ?? []).map((r) => ({
            id: r.id,
            kind: "user" as const,
            title: r.display_name || "(fără nume)",
            subtitle: [r.travel_city, r.id.slice(0, 8)].filter(Boolean).join(" · "),
            badges: [
              r.banned_at ? "BANNED" : null,
              r.suspended_until ? "SUSPENDED" : null,
              r.verified ? "verified" : null,
              ...(r.roles ?? []).map((x: string) => x.toUpperCase()),
            ].filter(Boolean) as string[],
            target: `/admin/users/${r.id}`,
          })),
        );
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, open, search]);

  const navMatches = useMemo(() => {
    const query = q.trim().toLowerCase();
    const src = items.filter((i) => !i.hidden);
    if (!query) return src.slice(0, 8);
    return src
      .filter(
        (i) =>
          i.label.toLowerCase().includes(query) ||
          i.group.toLowerCase().includes(query) ||
          (i.hint ?? "").toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [q, items]);

  const quickActions: Action[] = useMemo(() => {
    const acts: Action[] = [];
    const query = q.trim();
    if (isUuid(query)) {
      acts.push({
        id: "goto-user",
        label: `Deschide user #${query.slice(0, 8)}…`,
        hint: "User 360",
        icon: UserIcon,
        perform: () => {
          nav({ to: "/admin/users/$id", params: { id: query } });
          onClose();
        },
      });
    }
    if (query.length >= 2) {
      acts.push({
        id: "goto-reports",
        label: `Caută în rapoarte: "${query}"`,
        hint: "Trust & Safety",
        icon: ShieldAlert,
        perform: () => {
          onSelectNav("reports");
          onClose();
        },
      });
    }
    return acts;
  }, [q, nav, onClose, onSelectNav]);

  // Flat list for keyboard nav
  const flat: Array<{ type: "action" | "entity" | "nav"; run: () => void; key: string }> =
    useMemo(() => {
      const list: Array<{ type: "action" | "entity" | "nav"; run: () => void; key: string }> = [];
      quickActions.forEach((a) => list.push({ type: "action", run: a.perform, key: `a-${a.id}` }));
      entities.forEach((e) =>
        list.push({
          type: "entity",
          key: `e-${e.id}`,
          run: () => {
            nav({ to: "/admin/users/$id", params: { id: e.id } });
            onClose();
          },
        }),
      );
      navMatches.forEach((n) =>
        list.push({
          type: "nav",
          key: `n-${n.id}`,
          run: () => {
            onSelectNav(n.id);
            onClose();
          },
        }),
      );
      return list;
    }, [quickActions, entities, navMatches, nav, onClose, onSelectNav]);

  useEffect(() => {
    setCursor(0);
  }, [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[cursor]?.run();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 px-4 pt-[10vh] backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-primary/30 bg-surface/95 shadow-[0_30px_120px_-20px_oklch(0.82_0.115_85/0.35)]"
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Caută user (nume, oraș, UUID), modul, acțiune…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && <span className="text-[10px] text-muted-foreground">…</span>}
          <kbd className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {flat.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              {q.trim().length < 2
                ? "Începe să scrii… (min 2 caractere pentru useri)"
                : "Niciun rezultat."}
            </p>
          )}

          {quickActions.length > 0 && <SectionHeader label="Acțiuni rapide" icon={Zap} />}
          {quickActions.map((a, i) => {
            const idx = i;
            const active = cursor === idx;
            return (
              <Row key={a.id} active={active} onClick={a.perform}>
                <a.icon className="size-4 text-primary" />
                <span className="flex-1 truncate">{a.label}</span>
                {a.hint && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {a.hint}
                  </span>
                )}
              </Row>
            );
          })}

          {entities.length > 0 && <SectionHeader label="Utilizatori" icon={UserIcon} />}
          {entities.map((e, i) => {
            const idx = quickActions.length + i;
            const active = cursor === idx;
            return (
              <Row
                key={e.id}
                active={active}
                onClick={() => {
                  nav({ to: "/admin/users/$id", params: { id: e.id } });
                  onClose();
                }}
              >
                <UserIcon className="size-4 text-primary" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{e.title}</span>
                  <span className="truncate text-[10px] text-muted-foreground admin-mono">
                    {e.subtitle}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  {e.badges.slice(0, 3).map((b) => (
                    <span
                      key={b}
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                        b === "BANNED" || b === "SUSPENDED"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {b}
                    </span>
                  ))}
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </Row>
            );
          })}

          {navMatches.length > 0 && <SectionHeader label="Module & rute" icon={LayoutDashboard} />}
          {navMatches.map((n, i) => {
            const idx = quickActions.length + entities.length + i;
            const active = cursor === idx;
            const Icon = n.icon;
            return (
              <Row
                key={n.id}
                active={active}
                onClick={() => {
                  onSelectNav(n.id);
                  onClose();
                }}
              >
                <Icon className="size-4 text-primary" />
                <span className="flex-1 truncate">{n.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {n.group}
                </span>
              </Row>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-background/40 px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="size-3" /> deschide
            </span>
            <span>↑↓ navighează</span>
            <span className="flex items-center gap-1">
              <Hash className="size-3" /> lipește UUID pentru user 360
            </span>
          </span>
          <span className="flex items-center gap-1">
            <CmdIcon className="size-3" />K
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
      <Icon className="size-3" />
      {label}
    </div>
  );
}

function Row({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active ? "bg-primary/15 text-foreground" : "hover:bg-primary/5"
      }`}
    >
      {children}
    </button>
  );
}

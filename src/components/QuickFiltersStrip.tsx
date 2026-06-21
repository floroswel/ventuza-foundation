import { BadgeCheck, Camera, Flame, Image as ImageIcon, Plane, Rocket } from "lucide-react";
import type { DiscoverFilters } from "@/lib/discover";
import { TRIBE_OPTIONS, POSITION_OPTIONS } from "@/lib/profile-options";
import { cn } from "@/lib/utils";

function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

const TRIBES_SHORT = TRIBE_OPTIONS.slice(0, 8);
const POSITIONS_SHORT = POSITION_OPTIONS.slice(0, 5);

export function QuickFiltersStrip({
  value,
  onChange,
}: {
  value: DiscoverFilters;
  onChange: (f: DiscoverFilters) => void;
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-3 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Pill
        active={value.lookingNowOnly}
        onClick={() => onChange({ ...value, lookingNowOnly: !value.lookingNowOnly })}
        icon={<Flame className="size-3" />}
        tone="rose"
      >
        Right Now
      </Pill>
      <Pill
        active={value.verifiedOnly}
        onClick={() => onChange({ ...value, verifiedOnly: !value.verifiedOnly })}
        icon={<BadgeCheck className="size-3" />}
      >
        Verified
      </Pill>
      <Pill
        active={value.withPhotoOnly}
        onClick={() => onChange({ ...value, withPhotoOnly: !value.withPhotoOnly })}
        icon={<Camera className="size-3" />}
      >
        Has photo
      </Pill>

      <Divider />

      {POSITIONS_SHORT.map((p) => (
        <Pill
          key={p}
          active={value.positions.includes(p)}
          onClick={() => onChange({ ...value, positions: toggle(value.positions, p) })}
        >
          {p}
        </Pill>
      ))}

      <Divider />

      {TRIBES_SHORT.map((t) => (
        <Pill
          key={t}
          active={value.tribes.includes(t)}
          onClick={() => onChange({ ...value, tribes: toggle(value.tribes, t) })}
        >
          {t}
        </Pill>
      ))}
    </div>
  );
}

function Divider() {
  return <span className="my-auto h-4 w-px shrink-0 bg-border/60" />;
}

function Pill({
  active,
  onClick,
  children,
  icon,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "rose";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? tone === "rose"
            ? "border-rose-500/60 bg-rose-500/15 text-rose-400"
            : "border-primary/60 bg-primary/15 text-primary"
          : "border-border bg-surface text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

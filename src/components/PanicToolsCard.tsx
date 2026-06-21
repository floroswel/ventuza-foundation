import { useState } from "react";
import { CloudSun, Phone, Smartphone, AlertOctagon, Calculator, FileText } from "lucide-react";
import { FakeCallScreen } from "./FakeCallScreen";
import { applyDiscreetMode, loadDiscreetMode, type DiscreetSkin } from "@/lib/discreet-mode";
import { toast } from "sonner";

/** Panic exit + fake call + discreet icon switcher. All client-side. */
export function PanicToolsCard() {
  const [fakeCall, setFakeCall] = useState(false);
  const [skin, setSkin] = useState<DiscreetSkin>(() => (typeof window !== "undefined" ? loadDiscreetMode() : "off"));

  function panicExit() {
    // open neutral page, replace current to avoid back-button reveal
    window.location.replace("https://www.google.com/search?q=weather");
  }

  function pick(next: DiscreetSkin) {
    setSkin(next);
    applyDiscreetMode(next);
    toast.success(next === "off" ? "Aspect normal" : `Aspect: ${next}`);
  }

  const skins: Array<{ id: DiscreetSkin; label: string; icon: React.ReactNode }> = [
    { id: "off", label: "Normal", icon: <Smartphone className="size-4" /> },
    { id: "calculator", label: "Calculator", icon: <Calculator className="size-4" /> },
    { id: "weather", label: "Vreme", icon: <CloudSun className="size-4" /> },
    { id: "notes", label: "Notițe", icon: <FileText className="size-4" /> },
  ];

  return (
    <>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <AlertOctagon className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Unelte de siguranță</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Ieșire rapidă, apel fals și icon discret — pentru momentele când ai nevoie.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={panicExit}
            className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <AlertOctagon className="size-4" />
            Ieșire rapidă
          </button>
          <button
            onClick={() => setFakeCall(true)}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm hover:border-primary"
          >
            <Phone className="size-4" />
            Apel fals
          </button>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium">Aspect discret al iconului</p>
          <p className="text-[11px] text-muted-foreground">Schimbă titlul tab-ului și iconul.</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {skins.map((s) => (
              <button
                key={s.id}
                onClick={() => pick(s.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] transition ${skin === s.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {fakeCall && <FakeCallScreen onClose={() => setFakeCall(false)} />}
    </>
  );
}

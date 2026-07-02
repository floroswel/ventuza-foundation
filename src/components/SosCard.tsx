import { useEffect, useState } from "react";
import { AlertOctagon, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { triggerSos } from "@/lib/sos.functions";

type Contact = { name: string; phone?: string; email?: string };

const MAX_CONTACTS = 3;

export function SosCard() {
  const { user } = useAuth();
  const sos = useServerFn(triggerSos);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [draft, setDraft] = useState<Contact>({ name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [firing, setFiring] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("sos_contacts")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const list = (data?.sos_contacts as Contact[] | null) ?? [];
        setContacts(Array.isArray(list) ? list : []);
      });
  }, [user]);

  async function persist(next: Contact[]) {
    if (!user) return;
    setSaving(true);
    setContacts(next);
    const { error } = await supabase
      .from("profiles")
      .update({ sos_contacts: next })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
  }

  function addContact() {
    if (!draft.name.trim()) {
      toast.error("Adaugă un nume.");
      return;
    }
    if (!draft.phone?.trim() && !draft.email?.trim()) {
      toast.error("Adaugă telefon sau email.");
      return;
    }
    if (contacts.length >= MAX_CONTACTS) {
      toast.error("Maxim 3 contacte.");
      return;
    }
    void persist([...contacts, { ...draft, name: draft.name.trim() }]);
    setDraft({ name: "", phone: "", email: "" });
  }

  function removeContact(i: number) {
    void persist(contacts.filter((_, idx) => idx !== i));
  }

  async function fireSOS() {
    setFiring(true);
    try {
      let coords: { latitude?: number; longitude?: number } = {};
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            timeout: 4000,
            enableHighAccuracy: true,
          }),
        );
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch {
        /* locație opțională */
      }

      const result = await sos({ data: { ...coords } });

      // Open native handlers so user can confirm sending each notification.
      const encoded = encodeURIComponent(result.message);
      const targets = result.contacts as Contact[];
      let opened = 0;
      for (const c of targets) {
        if (c.phone) {
          const url = `sms:${c.phone}?body=${encoded}`;
          window.open(url, "_blank");
          opened++;
        } else if (c.email) {
          const url = `mailto:${c.email}?subject=${encodeURIComponent("SOS Ventuza")}&body=${encoded}`;
          window.open(url, "_blank");
          opened++;
        }
      }
      toast.success(
        opened > 0
          ? `SOS pregătit pentru ${opened} contact(e). Confirmă trimiterea.`
          : "SOS logat. Adaugă contacte pentru a notifica.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFiring(false);
      setArmed(false);
    }
  }

  return (
    <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
        <AlertOctagon className="size-4" /> Buton SOS
        {saving && <Loader2 className="ml-1 size-3 animate-spin" />}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        La apăsare: trimite locația ta către contactele de încredere (până la 3). Doar pentru
        urgențe reale.
      </p>

      <ul className="mt-3 space-y-2">
        {contacts.map((c, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-xs"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{c.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{c.phone || c.email}</p>
            </div>
            <button
              onClick={() => removeContact(i)}
              className="ml-2 rounded-full p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {contacts.length < MAX_CONTACTS && (
        <div className="mt-3 space-y-2 rounded-xl border border-dashed border-border bg-background/40 p-3">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Nume (ex: Mama)"
            maxLength={40}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="Telefon"
              type="tel"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
            <input
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="Email"
              type="email"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={addContact}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-border bg-surface py-1.5 text-xs hover:border-primary"
          >
            <Plus className="size-3.5" /> Adaugă contact
          </button>
        </div>
      )}

      <div className="mt-4 border-t border-destructive/30 pt-3">
        {!armed ? (
          <button
            onClick={() => setArmed(true)}
            disabled={contacts.length === 0}
            className="w-full rounded-full bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          >
            🚨 Activează SOS
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-center text-xs font-medium text-destructive">
              Confirmă: trimite SOS acum?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setArmed(false)}
                className="rounded-full border border-border bg-background py-2 text-xs"
              >
                Anulează
              </button>
              <button
                onClick={fireSOS}
                disabled={firing}
                className="flex items-center justify-center gap-1.5 rounded-full bg-destructive py-2 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {firing ? <Loader2 className="size-3 animate-spin" /> : "Trimite SOS"}
              </button>
            </div>
          </div>
        )}
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          În caz de pericol imediat:{" "}
          <a href="tel:112" className="font-semibold text-destructive">
            sună 112
          </a>
          . Linie ACCEPT LGBTQ+:{" "}
          <a href="tel:+40213120884" className="font-medium underline">
            021 312 0884
          </a>
          .
        </p>
      </div>
    </section>
  );
}

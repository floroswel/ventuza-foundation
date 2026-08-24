/**
 * Insignă de rol staff — vizibilă DOAR pentru propriul cont (owner) și în
 * panoul admin. Nu se expune altor utilizatori (evităm expunerea echipei
 * într-o aplicație de dating).
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { getMyStaffRole } from "@/lib/admin-grants.functions";

const LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  auditor: "Auditor",
  moderator: "Moderator",
  support: "Suport",
  read_only: "Read-only",
  verification_moderator: "Moderator verificări",
};

export function StaffRoleBadge({ className }: { className?: string }) {
  const fetchRole = useServerFn(getMyStaffRole);
  const { data } = useQuery({
    queryKey: ["my-staff-role"],
    queryFn: () => fetchRole({}),
    staleTime: 5 * 60_000,
  });

  const role = data?.role;
  if (!role || !LABELS[role]) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary ${className ?? ""}`}
      title="Rol de echipă — vizibil doar pentru tine"
    >
      <ShieldCheck className="size-3" /> Echipa Suzeta · {LABELS[role]}
    </span>
  );
}

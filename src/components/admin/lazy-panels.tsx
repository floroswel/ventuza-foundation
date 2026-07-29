/**
 * Lazy wrappers pentru toate panourile /admin.
 *
 * Motivul existenței:
 *   `src/routes/admin.tsx` importa static 30+ panouri; chunk-ul admin ajunsese
 *   ~430 KB (client). Panourile sunt afișate câte unul singur per tab, deci
 *   este suficient să le încărcăm on-demand. Fiecare wrapper e propriul
 *   `React.lazy`, cu Suspense inline, ca să nu atingem call site-urile.
 *
 * Nu adăuga aici componente care sunt afișate MEREU în admin
 * (ex. AdminShell, primitives, DataTable) — acelea rămân în chunk-ul de bază.
 */
import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";

function Fallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

function wrap<P extends object>(Lazy: ComponentType<P>) {
  const Wrapped = (props: P) => (
    <Suspense fallback={<Fallback />}>
      <Lazy {...props} />
    </Suspense>
  );
  Wrapped.displayName = "LazyAdminPanel";
  return Wrapped;
}

// —— Panouri simple (fișier per component) ———————————————————————————————————
export const SystemHealthPanel = wrap(
  lazy(() => import("./SystemHealthPanel").then((m) => ({ default: m.SystemHealthPanel }))),
);
export const CrashLogPanel = wrap(
  lazy(() => import("./CrashLogPanel").then((m) => ({ default: m.CrashLogPanel }))),
);
export const AiCopilotPanel = wrap(
  lazy(() => import("./AiCopilotPanel").then((m) => ({ default: m.AiCopilotPanel }))),
);
export const PartnersModerationPanel = wrap(
  lazy(() =>
    import("./PartnersModerationPanel").then((m) => ({ default: m.PartnersModerationPanel })),
  ),
);
export const BillingAdminPanel = wrap(
  lazy(() => import("./BillingAdminPanel").then((m) => ({ default: m.BillingAdminPanel }))),
);
export const ExperimentsPanel = wrap(
  lazy(() => import("./ExperimentsPanel").then((m) => ({ default: m.ExperimentsPanel }))),
);
export const RateLimitPanel = wrap(
  lazy(() => import("./RateLimitPanel").then((m) => ({ default: m.RateLimitPanel }))),
);
export const SecuritySignalsPanel = wrap(
  lazy(() => import("./SecuritySignalsPanel").then((m) => ({ default: m.SecuritySignalsPanel }))),
);
export const RiskDashboardPanel = wrap(
  lazy(() => import("./RiskDashboardPanel").then((m) => ({ default: m.RiskDashboardPanel }))),
);
export const RiskReviewQueuePanel = wrap(
  lazy(() => import("./RiskReviewQueuePanel").then((m) => ({ default: m.RiskReviewQueuePanel }))),
);
export const SignupThrottlePanel = wrap(
  lazy(() => import("./SignupThrottlePanel").then((m) => ({ default: m.SignupThrottlePanel }))),
);
export const SettingsAndFlagsPanel = wrap(
  lazy(() => import("./SettingsAndFlagsPanel").then((m) => ({ default: m.SettingsAndFlagsPanel }))),
);
export const StaffManagementPanel = wrap(
  lazy(() => import("./StaffManagementPanel").then((m) => ({ default: m.StaffManagementPanel }))),
);
export const AdminToolsPanel = wrap(
  lazy(() => import("./AdminToolsPanel").then((m) => ({ default: m.AdminToolsPanel }))),
);
export const SupportTicketsPanel = wrap(
  lazy(() => import("./SupportTicketsPanel").then((m) => ({ default: m.SupportTicketsPanel }))),
);
export const AppealsPanel = wrap(
  lazy(() => import("./AppealsPanel").then((m) => ({ default: m.AppealsPanel }))),
);
export const OperationsUserOpsPanel = wrap(
  lazy(() =>
    import("./OperationsUserOpsPanel").then((m) => ({ default: m.OperationsUserOpsPanel })),
  ),
);
export const BroadcastV2Panel = wrap(
  lazy(() => import("./BroadcastV2Panel").then((m) => ({ default: m.BroadcastV2Panel }))),
);
export const IntelligenceDashboardPanel = wrap(
  lazy(() =>
    import("./IntelligenceDashboardPanel").then((m) => ({
      default: m.IntelligenceDashboardPanel,
    })),
  ),
);
export const KillSwitchesPanel = wrap(
  lazy(() => import("./KillSwitchesPanel").then((m) => ({ default: m.KillSwitchesPanel }))),
);
export const PushHealthPanel = wrap(
  lazy(() => import("./PushHealthPanel").then((m) => ({ default: m.PushHealthPanel }))),
);
export const PartnerBoostCalendarPanel = wrap(
  lazy(() =>
    import("./PartnerBoostCalendarPanel").then((m) => ({ default: m.PartnerBoostCalendarPanel })),
  ),
);
export const FraudClusterPanel = wrap(
  lazy(() => import("./FraudClusterPanel").then((m) => ({ default: m.FraudClusterPanel }))),
);
export const LegalP0Panel = wrap(
  lazy(() => import("./LegalP0Panel").then((m) => ({ default: m.LegalP0Panel }))),
);
export const PolicyEnginePanel = wrap(
  lazy(() => import("./PolicyEnginePanel").then((m) => ({ default: m.PolicyEnginePanel }))),
);
export const EnterpriseUsersPanel = wrap(
  lazy(() => import("./EnterpriseUsersPanel").then((m) => ({ default: m.EnterpriseUsersPanel }))),
);
export const LegalDocsAdminPanel = wrap(
  lazy(() => import("./LegalDocsAdminPanel").then((m) => ({ default: m.LegalDocsAdminPanel }))),
);
export const OverviewPanelRich = wrap(
  lazy(() => import("./OverviewPanelRich").then((m) => ({ default: m.OverviewPanelRich }))),
);
export const AlertRulesPanel = wrap(
  lazy(() => import("./AlertRulesPanel").then((m) => ({ default: m.AlertRulesPanel }))),
);
export const SupportMacrosPanel = wrap(
  lazy(() => import("./SupportMacrosPanel").then((m) => ({ default: m.SupportMacrosPanel }))),
);
export const VerificationQueuePanel = wrap(
  lazy(() =>
    import("./VerificationQueuePanel").then((m) => ({ default: m.VerificationQueuePanel })),
  ),
);
export const AnalyticsPanel = wrap(
  lazy(() => import("../AnalyticsPanel").then((m) => ({ default: m.AnalyticsPanel }))),
);

// —— Barrel-uri (multiplu export per fișier → un singur chunk partajat) ————
export const AuditLogPanel = wrap(
  lazy(() => import("./EnterpriseSections").then((m) => ({ default: m.AuditLogPanel }))),
);
export const AlertsPanel = wrap(
  lazy(() => import("./EnterpriseSections").then((m) => ({ default: m.AlertsPanel }))),
);
export const DsaPanel = wrap(
  lazy(() => import("./EnterpriseSections").then((m) => ({ default: m.DsaPanel }))),
);
export const CsamPanel = wrap(
  lazy(() => import("./EnterpriseSections").then((m) => ({ default: m.CsamPanel }))),
);
export const BreachPanel = wrap(
  lazy(() => import("./EnterpriseSections").then((m) => ({ default: m.BreachPanel }))),
);
export const PoliciesPanel = wrap(
  lazy(() => import("./EnterpriseSections").then((m) => ({ default: m.PoliciesPanel }))),
);
export const SecurityPanel = wrap(
  lazy(() => import("./EnterpriseSections").then((m) => ({ default: m.SecurityPanel }))),
);

export const GdprOpsPanel = wrap(
  lazy(() => import("./Wave1Sections").then((m) => ({ default: m.GdprOpsPanel }))),
);
export const BreakGlassLogPanel = wrap(
  lazy(() => import("./Wave1Sections").then((m) => ({ default: m.BreakGlassLogPanel }))),
);

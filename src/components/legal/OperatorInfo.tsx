/**
 * Sursă unică pentru datele operatorului legal și pentru referirea consecventă
 * la marca "Ventuza". Orice pagină legală trebuie să folosească aceste constante
 * ȘI/SAU componentele expuse aici, ca datele să rămână identice în toate locurile.
 */

export const OPERATOR = {
  legalName: "VOMIX GENIUS S.R.L.",
  brand: "Ventuza",
  cui: "43025661",
  regCom: "J2020000459343",
  address: "Str. Constructorilor 39, Voievoda, Teleorman, 147148, România",
  legalRepresentative: "Florin Ionut Gica",
  bank: "Banca Transilvania S.A.",
  iban: "RO50BTRLRONCRT0566231601",
  emails: {
    dpo: "dpo@ventuza.app",
    privacy: "privacy@ventuza.app",
    support: "support@ventuza.app",
    business: "business@ventuza.app",
    dsa: "dsa@ventuza.app",
    trust: "trust@ventuza.app",
    appeals: "appeals@ventuza.app",
    abuse: "abuse@ventuza.app",
    csam: "csam@ventuza.app",
    parents: "parents@ventuza.app",
    copyright: "copyright@ventuza.app",
    security: "security@ventuza.app",
  },
} as const;

/** Descriere scurtă a operatorului — de folosit în paragrafele care menționează
 *  operatorul pentru prima dată. */
export const OPERATOR_INTRO =
  `${OPERATOR.legalName} (operatorul care deține și operează aplicația ${OPERATOR.brand})`;

/**
 * Bloc detaliat de identificare a operatorului (nume, CUI, J40, sediu,
 * reprezentant legal, DPO). Se folosește într-o secțiune dedicată la finalul
 * fiecărei pagini legale.
 */
export function OperatorIdentificationBlock({
  compact = false,
  includeIban = false,
}: {
  compact?: boolean;
  includeIban?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-lg border border-border bg-surface/40 p-3 text-xs leading-relaxed text-foreground/85"
          : "rounded-xl border border-border bg-surface/40 p-4 text-sm leading-relaxed text-foreground/85"
      }
    >
      <p className="font-semibold text-foreground">{OPERATOR.legalName}</p>
      <p className="mt-1">
        Operatorul de date care deține și operează aplicația <strong>{OPERATOR.brand}</strong>.
      </p>
      <ul className="mt-2 space-y-0.5">
        <li>
          <span className="text-muted-foreground">CUI:</span> {OPERATOR.cui}
        </li>
        <li>
          <span className="text-muted-foreground">Nr. Reg. Com.:</span> {OPERATOR.regCom}
        </li>
        <li>
          <span className="text-muted-foreground">Sediu social:</span> {OPERATOR.address}
        </li>
        <li>
          <span className="text-muted-foreground">Reprezentant legal:</span>{" "}
          {OPERATOR.legalRepresentative}
        </li>
        {includeIban && (
          <li>
            <span className="text-muted-foreground">IBAN:</span> {OPERATOR.iban} ({OPERATOR.bank})
          </li>
        )}
        <li>
          <span className="text-muted-foreground">DPO / GDPR:</span>{" "}
          <a className="text-primary" href={`mailto:${OPERATOR.emails.dpo}`}>
            {OPERATOR.emails.dpo}
          </a>
        </li>
      </ul>
    </div>
  );
}

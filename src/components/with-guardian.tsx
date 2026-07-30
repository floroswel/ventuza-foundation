/**
 * withGuardian — HOC pentru izolarea unei rute/zone într-un Error Boundary
 * Guardian. Folosit în definițiile de rută:
 *   component: withGuardian("chat", ThreadPage)
 */
import type { ComponentType } from "react";
import { GuardianBoundary } from "@/components/GuardianBoundary";
import type { GuardianCategory } from "@/lib/guardian/core";

export function withGuardian<P extends object>(
  area: string,
  Comp: ComponentType<P>,
  category?: GuardianCategory,
) {
  const Wrapped = (props: P) => (
    <GuardianBoundary area={area} category={category}>
      <Comp {...props} />
    </GuardianBoundary>
  );
  Wrapped.displayName = `withGuardian(${area})`;
  return Wrapped;
}

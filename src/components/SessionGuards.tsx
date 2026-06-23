import { useDeviceFingerprint } from "@/hooks/useDeviceFingerprint";

/** Invisible component that wires session-scoped background guards. */
export function SessionGuards() {
  useDeviceFingerprint();
  return null;
}

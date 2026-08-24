// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(() => Promise.resolve({ data: 1, error: null })) },
}));
import { supabase } from "@/integrations/supabase/client";
const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

import { trackStoreFunnelOnce, trackNativeFirstOpen, trackAppLinkOpen } from "@/lib/store-analytics";

beforeEach(() => {
  localStorage.clear();
  rpc.mockClear();
});

describe("funnel dedupe", () => {
  it("install_first_open o singură dată", () => {
    trackNativeFirstOpen();
    trackNativeFirstOpen();
    trackNativeFirstOpen();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect((rpc.mock.calls[0] as any[])[1]._dedupe_key).toContain("install_first_open:");
  });
  it("app_link_open deduplicat pe aceeași cale", () => {
    trackAppLinkOpen("/u/andrei");
    const again = trackAppLinkOpen("/u/andrei");
    expect(again).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(trackAppLinkOpen("/venues/1")).toBe(true);
  });
  it("cheia e trimisă la server", () => {
    trackStoreFunnelOnce("app_link_open", "k1");
    expect((rpc.mock.calls[0] as any[])[1]._dedupe_key).toBe("app_link_open:k1");
  });
});

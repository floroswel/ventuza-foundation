export const MOBILE_BUILD_SHA = import.meta.env.VITE_BUILD_SHA || "dev";
export const MOBILE_VERSION_CODE = import.meta.env.VITE_BUILD_VERSION_CODE || "dev";
export const NATIVE_REPAIR_MARKER = "SUZETA_NATIVE_FIX_V3";

export const shortBuildSha = MOBILE_BUILD_SHA.slice(0, 7);
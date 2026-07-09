// Wrapper camera/galerie — plugin @capacitor/camera pe Android, fallback <input type=file>.
// Întoarce File pentru a fi compatibil cu pipeline-ul existent (compressImageForChat etc).

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export type PickSource = "camera" | "gallery";

async function nativePick(source: PickSource): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const perm = await Camera.checkPermissions();
  if (source === "camera" && perm.camera !== "granted") {
    const r = await Camera.requestPermissions({ permissions: ["camera"] });
    if (r.camera !== "granted") return null;
  }
  if (source === "gallery" && perm.photos !== "granted" && perm.photos !== "limited") {
    const r = await Camera.requestPermissions({ permissions: ["photos"] });
    if (r.photos !== "granted" && r.photos !== "limited") return null;
  }
  const photo = await Camera.getPhoto({
    quality: 88,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
    correctOrientation: true,
  });
  const b64 = photo.base64String;
  if (!b64) return null;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const mime = `image/${photo.format || "jpeg"}`;
  return new File([bytes], `photo-${Date.now()}.${photo.format || "jpg"}`, { type: mime });
}

/** Deschide camera nativă / galerie și întoarce un File (sau null dacă utilizatorul anulează). */
export async function pickImage(source: PickSource): Promise<File | null> {
  if (await isNative()) {
    try {
      return await nativePick(source);
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      if (/cancel/i.test(msg)) return null;
      throw e;
    }
  }
  return webPickImage(source);
}

/** Fallback web: deschide un <input type=file> dinamic. */
export function webPickImage(source: PickSource): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (source === "camera") input.capture = "environment";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function isNativeCameraAvailable(): Promise<boolean> {
  return isNative();
}

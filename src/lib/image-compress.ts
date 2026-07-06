// Client-side image compression pentru upload rapid în chat.
// Reduce imaginile mari la max 2048px pe latura lungă și encode JPEG 82%.
// Fișierele deja mici (< 400KB) sunt trimise ca atare.
export async function compressImageForChat(
  file: File | Blob,
  opts: { maxDim?: number; quality?: number; forceJpeg?: boolean } = {},
): Promise<Blob> {
  const maxDim = opts.maxDim ?? 2048;
  const quality = opts.quality ?? 0.82;
  const size = (file as File).size ?? 0;
  const type = (file as File).type ?? "";

  // GIFs: keep as-is (animation would be lost).
  if (type === "image/gif") return file;
  // Small enough already
  if (size > 0 && size < 400 * 1024 && !opts.forceJpeg) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = (canvas as HTMLCanvasElement).getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob = await (canvas instanceof OffscreenCanvas
      ? canvas.convertToBlob({ type: "image/jpeg", quality })
      : new Promise((res, rej) => {
          (canvas as HTMLCanvasElement).toBlob(
            (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
            "image/jpeg",
            quality,
          );
        }));
    // If compression made it bigger (rare), keep original
    return blob.size > 0 && blob.size < size ? blob : blob;
  } catch (err) {
    console.warn("[image-compress] fallback to original", err);
    return file;
  }
}

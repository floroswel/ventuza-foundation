// Lightweight perceptual average-hash (aHash) — 64-bit, returned as 16-char hex.
// Sufficient for detecting near-duplicate photos uploaded by different accounts.
export async function computePhash(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = 8;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const gray: number[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray.push(g);
      sum += g;
    }
    const avg = sum / gray.length;
    let bits = "";
    for (const v of gray) bits += v >= avg ? "1" : "0";
    // 64 bits → 16 hex chars
    let hex = "";
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return null;
  }
}

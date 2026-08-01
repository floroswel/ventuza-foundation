/**
 * Logo-ul Suzeta servit ca fișier local din `public/`.
 *
 * De ce nu CDN (`*.asset.json`): în build-ul nativ Capacitor aplicația rulează
 * de pe `https://localhost` (WebView) și servește DOAR fișierele din `dist/`.
 * URL-urile `/__l5e/assets-v1/...` nu există acolo → imaginea dă 404 și logo-ul
 * nu se afișează în app. Fișierul din `public/` intră în bundle, deci merge și
 * pe web, și în nativ, și offline.
 */
export const SUZETA_ICON_URL = "/brand/suzeta-icon.png";

/**
 * Logo-ul Suzeta servit ca fișier local din `public/`.
 *
 * De ce nu CDN (`*.asset.json`): în build-ul nativ Capacitor aplicația rulează
 * de pe `https://localhost` (WebView) și servește DOAR fișierele din `dist/`.
 * URL-urile `/__l5e/assets-v1/...` nu există acolo → imaginea dă 404 și logo-ul
 * nu se afișează în app. Fișierul din `public/` intră în bundle, deci merge și
 * pe web, și în nativ, și offline.
 */
/**
 * WebP la 288px: logo-ul se afișează la 72-88 CSS px, deci 288 acoperă și
 * ecranele la 3x. PNG-ul anterior era 1024x1024 și cântărea 795 KB — cel mai
 * greu fișier din prima încărcare, mai mult decât tot JS-ul de pornire.
 * WebP e suportat de Chrome 32+ / Android 4.2+, cu mult sub pragul aplicației.
 */
export const SUZETA_ICON_URL = "/brand/suzeta-icon.webp";

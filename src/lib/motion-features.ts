/**
 * Chunk separat cu feature-urile framer-motion (drag + layout + gestures).
 * Încărcat lazy de `<LazyMotion>` din `src/routes/__root.tsx`, ca bundle-ul
 * inițial (mobil / AAB) să nu conțină motorul complet de animație.
 */
export { domMax as default } from "framer-motion";

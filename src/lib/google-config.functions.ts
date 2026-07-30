import { createServerFn } from "@tanstack/react-start";

/**
 * Google OAuth Web Client ID.
 *
 * De ce server fn și nu doar `VITE_GOOGLE_WEB_CLIENT_ID`: valoarea e stocată ca
 * secret de proiect (`GOOGLE_OAUTH_CLIENT_ID`), iar variabilele `VITE_*` se
 * inline-uiesc la build — nu putem citi secretul în build. Client ID-ul OAuth
 * este PUBLIC prin design (apare oricum în URL-ul de authorize și în APK), deci
 * expunerea lui printr-un endpoint public este sigură. Secretul OAuth NU trece
 * niciodată pe aici.
 */
export const getGoogleWebClientId = createServerFn({ method: "GET" }).handler(
  async () => {
    const id = (process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim();
    return { clientId: id || null };
  },
);

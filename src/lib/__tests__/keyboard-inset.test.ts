/**
 * Tastatura Android nu trebuie să acopere composer-ul din chat.
 *
 * Testele acoperă exact regulile de care depinde fixul:
 *  - două surse pentru aceeași tastatură se combină cu `max`, nu prin adunare
 *    (adunarea a fost cauza suprapunerii: nativ redimensiona ȘI CSS-ul adăuga);
 *  - pragul de deschidere filtrează zgomotul;
 *  - ancorarea la ultimul mesaj se face doar dacă utilizatorul era deja jos;
 *  - la închiderea tastaturii nu rămâne spațiu rezervat.
 */
import { describe, it, expect } from "vitest";
import {
  effectiveKeyboardHeight,
  isKeyboardOpen,
  distanceFromBottom,
  isNearBottom,
  bottomScrollTop,
  keyboardHeightFromViewport,
  KEYBOARD_OPEN_THRESHOLD_PX,
} from "@/lib/keyboard-inset";

describe("effectiveKeyboardHeight — o singură compensare", () => {
  it("ia maximul, nu suma, când ambele surse raportează aceeași tastatură", () => {
    // Regresia originală: 320 nativ + 320 CSS = 640 → composer împins de două ori.
    expect(effectiveKeyboardHeight(320, 320)).toBe(320);
  });

  it("funcționează dacă doar pluginul raportează", () => {
    expect(effectiveKeyboardHeight(288, 0)).toBe(288);
  });

  it("funcționează dacă doar insetul IME raportează", () => {
    expect(effectiveKeyboardHeight(0, 301)).toBe(301);
  });

  it("preferă valoarea mai mare când sursele diferă ușor", () => {
    expect(effectiveKeyboardHeight(300, 312)).toBe(312);
  });

  it("întoarce 0 când tastatura e închisă", () => {
    expect(effectiveKeyboardHeight(0, 0)).toBe(0);
  });

  it("ignoră valori lipsă sau invalide în loc să producă NaN", () => {
    expect(effectiveKeyboardHeight(undefined, null, Number.NaN, 250)).toBe(250);
    expect(effectiveKeyboardHeight(undefined, null)).toBe(0);
    expect(effectiveKeyboardHeight(Number.POSITIVE_INFINITY, 100)).toBe(100);
  });

  it("nu întoarce valori negative", () => {
    expect(effectiveKeyboardHeight(-40, -10)).toBe(0);
  });
});

describe("isKeyboardOpen — prag anti-zgomot", () => {
  it("o tastatură reală este deschisă", () => {
    expect(isKeyboardOpen(320)).toBe(true);
  });

  it("0 înseamnă închisă", () => {
    expect(isKeyboardOpen(0)).toBe(false);
  });

  it("câțiva pixeli de zgomot nu deschid tastatura", () => {
    expect(isKeyboardOpen(KEYBOARD_OPEN_THRESHOLD_PX)).toBe(false);
    expect(isKeyboardOpen(KEYBOARD_OPEN_THRESHOLD_PX + 1)).toBe(true);
  });

  it("valorile lipsă nu sunt considerate deschise", () => {
    expect(isKeyboardOpen(undefined)).toBe(false);
    expect(isKeyboardOpen(null)).toBe(false);
    expect(isKeyboardOpen(Number.NaN)).toBe(false);
  });
});

describe("ancorarea listei de mesaje", () => {
  it("distanța până la bază nu e negativă nici la overscroll", () => {
    expect(distanceFromBottom({ scrollTop: 1200, scrollHeight: 1000, clientHeight: 400 })).toBe(0);
  });

  it("recunoaște că utilizatorul era la ultimul mesaj", () => {
    expect(isNearBottom({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
  });

  it("nu smucește utilizatorul care citește istoricul", () => {
    expect(isNearBottom({ scrollTop: 0, scrollHeight: 5000, clientHeight: 400 })).toBe(false);
  });

  it("scrollTop-ul de bază aduce ultimul mesaj deasupra composer-ului", () => {
    // Lista s-a micșorat cu înălțimea tastaturii: clientHeight 400 -> 120.
    expect(bottomScrollTop({ scrollHeight: 1000, clientHeight: 120 })).toBe(880);
  });

  it("nu cere scroll când conținutul încape întreg", () => {
    expect(bottomScrollTop({ scrollHeight: 300, clientHeight: 400 })).toBe(0);
  });

  it("layout-ul revine corect după închiderea tastaturii", () => {
    const closed = effectiveKeyboardHeight(0, 0);
    expect(closed).toBe(0);
    expect(isKeyboardOpen(closed)).toBe(false);
    // Fără spațiu rezervat, lista își recapătă toată înălțimea.
    expect(bottomScrollTop({ scrollHeight: 1000, clientHeight: 400 })).toBe(600);
  });
});

describe("keyboardHeightFromViewport — sursa visualViewport", () => {
  it("deduce tastatura din micșorarea viewportului vizual", () => {
    expect(keyboardHeightFromViewport({ innerHeight: 800, viewportHeight: 480 })).toBe(320);
  });

  it("scade offsetTop, altfel derularea viewportului ar părea tastatură", () => {
    expect(keyboardHeightFromViewport({ innerHeight: 800, viewportHeight: 480, offsetTop: 40 })).toBe(280);
  });

  it("întoarce 0 când tastatura e închisă", () => {
    expect(keyboardHeightFromViewport({ innerHeight: 800, viewportHeight: 800 })).toBe(0);
  });

  it("ignoră diferențele mici (bare de browser, rotunjiri)", () => {
    expect(keyboardHeightFromViewport({ innerHeight: 800, viewportHeight: 800 - KEYBOARD_OPEN_THRESHOLD_PX })).toBe(0);
    expect(keyboardHeightFromViewport({ innerHeight: 800, viewportHeight: 800 - KEYBOARD_OPEN_THRESHOLD_PX - 1 })).toBe(
      KEYBOARD_OPEN_THRESHOLD_PX + 1,
    );
  });

  it("nu întoarce negativ dacă viewportul vizual e mai mare", () => {
    expect(keyboardHeightFromViewport({ innerHeight: 480, viewportHeight: 800 })).toBe(0);
  });

  it("tolerează valori invalide", () => {
    expect(keyboardHeightFromViewport({ innerHeight: Number.NaN, viewportHeight: 480 })).toBe(0);
    expect(keyboardHeightFromViewport({ innerHeight: 800, viewportHeight: Number.NaN })).toBe(0);
    expect(keyboardHeightFromViewport({ innerHeight: 800, viewportHeight: 480, offsetTop: Number.NaN })).toBe(0);
  });

  it("rotunjește fracțiunile de densitate", () => {
    expect(keyboardHeightFromViewport({ innerHeight: 800, viewportHeight: 479.6 })).toBe(320);
  });

  it("se combină cu celelalte surse fără să le însumeze", () => {
    const viewport = keyboardHeightFromViewport({ innerHeight: 800, viewportHeight: 480 });
    expect(effectiveKeyboardHeight(0, 0, viewport)).toBe(320);
    expect(effectiveKeyboardHeight(320, 320, viewport)).toBe(320);
  });
});

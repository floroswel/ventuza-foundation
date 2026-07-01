import { createFileRoute } from "@tanstack/react-router";
import { ProfilePhotoGallery } from "@/components/ProfilePhotoGallery";

// Rută temporară pentru teste automate de accesibilitate (focus trap + Esc).
// Ștearsă după validare — nu o linka din navigare.
export const Route = createFileRoute("/gallery-test")({
  component: GalleryTestPage,
});

const PHOTOS = [
  "https://picsum.photos/seed/a/800/800",
  "https://picsum.photos/seed/b/800/800",
  "https://picsum.photos/seed/c/800/800",
];

function GalleryTestPage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-lg font-semibold">Gallery a11y test</h1>
      <button data-testid="outside-before" className="mb-2 rounded border px-3 py-1">
        Outside Before
      </button>
      <ProfilePhotoGallery
        photos={PHOTOS}
        alt="Test"
        fullscreenExtra={
          <div className="space-y-3 p-6">
            <h2 className="text-base font-semibold">Extra content</h2>
            <button data-testid="extra-btn-1" className="rounded border border-white/40 px-3 py-1">
              Extra 1
            </button>
            <button data-testid="extra-btn-2" className="rounded border border-white/40 px-3 py-1">
              Extra 2
            </button>
            <a data-testid="extra-link" href="#" className="block underline">
              Extra link
            </a>
          </div>
        }
      />
      <button data-testid="outside-after" className="mt-2 rounded border px-3 py-1">
        Outside After
      </button>
    </main>
  );
}

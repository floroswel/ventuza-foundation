import { Outlet, createFileRoute, useRouter } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/messages")({
  component: MessagesLayout,
  errorComponent: MessagesErrorBoundary,
});

function MessagesLayout() {
  return <Outlet />;
}

function MessagesErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-background px-6 text-center">
      <MessageCircle className="size-10 text-primary" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold text-foreground">Mesajele nu s-au încărcat</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reîncercăm doar această secțiune, fără să blocăm restul aplicației.
      </p>
      <p className="sr-only">{error.message}</p>
      <Button
        type="button"
        className="mt-6"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Reîncearcă
      </Button>
    </main>
  );
}
"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * App-wide toast host. Mount once near the root. Styling inherits the design tokens.
 * Re-exports `toast` (with `toast.success`, `toast.error`, and action/undo support).
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "rounded-card border bg-card text-card-foreground shadow-card",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
        },
      }}
    />
  );
}

export { toast };

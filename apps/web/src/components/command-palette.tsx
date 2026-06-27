"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { NAV } from "@/lib/navigation";
import { useUiStore } from "@/stores/ui-store";

/** Global ⌘K / Ctrl+K command palette for fast navigation (search lands in Phase 9). */
export function CommandPalette() {
  const router = useRouter();
  const { can } = useAuth();
  const { commandOpen, setCommandOpen } = useUiStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
      if (e.key === "Escape") setCommandOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  if (!commandOpen) return null;

  const items = NAV.filter((n) => can(n.module, "view"));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[15vh] backdrop-blur-sm"
      onClick={() => setCommandOpen(false)}
    >
      <Command
        className="w-full max-w-lg overflow-hidden rounded-card border bg-popover text-popover-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
        loop
      >
        <Command.Input
          autoFocus
          placeholder="Search modules and actions…"
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results.
          </Command.Empty>
          <Command.Group heading="Navigate" className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
            {items.map((n) => (
              <Command.Item
                key={n.module}
                value={n.label}
                onSelect={() => {
                  setCommandOpen(false);
                  router.push(n.href);
                }}
                className="flex cursor-pointer items-center rounded-sm px-2 py-2 text-sm text-foreground aria-selected:bg-secondary"
              >
                {n.label}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

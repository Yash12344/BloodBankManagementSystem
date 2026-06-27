import { Loader2 } from "lucide-react";
import * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Skeleton } from "./skeleton";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />;
}

/** Empty-state block with optional icon, message and a call-to-action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-16 text-center", className)}>
      {icon && <div className="mb-1 text-muted-foreground">{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <h3 className="text-sm font-semibold text-destructive">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          Try again
        </Button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/**
 * Declarative wrapper that renders the right state for an async list/resource:
 * loading skeleton, error (with retry), empty, or the children when data is present.
 */
export function DataState<T>({
  loading,
  error,
  data,
  onRetry,
  empty,
  skeleton,
  children,
}: {
  loading: boolean;
  error?: unknown;
  data: T[] | undefined;
  onRetry?: () => void;
  empty: React.ReactNode;
  skeleton?: React.ReactNode;
  children: (data: T[]) => React.ReactNode;
}) {
  if (loading) return <>{skeleton ?? <ListSkeleton />}</>;
  if (error)
    return <ErrorState description={error instanceof Error ? error.message : undefined} onRetry={onRetry} />;
  if (!data || data.length === 0) return <>{empty}</>;
  return <>{children(data)}</>;
}

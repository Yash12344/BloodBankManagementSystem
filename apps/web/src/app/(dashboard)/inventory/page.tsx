"use client";

import { BLOOD_GROUP_LABEL } from "@bloodline/types";
import {
  Badge,
  Card,
  cn,
  ErrorState,
  ListSkeleton,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@bloodline/ui";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchCellUnits, useInventoryMatrix, type CellUnit, type MatrixCell } from "@/lib/inventory";

const COMPONENT_LABEL: Record<string, string> = {
  WHOLE_BLOOD: "Whole",
  PRBC: "PRBC",
  PLATELETS: "Platelets",
  FFP: "FFP",
  CRYO: "Cryo",
};

const LEVEL_CLASS: Record<MatrixCell["level"], string> = {
  critical: "bg-destructive/15 text-destructive",
  low: "bg-warning/15 text-warning",
  ok: "bg-success/10 text-success",
};

function groupLabel(g: string) {
  return BLOOD_GROUP_LABEL[g as keyof typeof BLOOD_GROUP_LABEL] ?? g;
}

export default function InventoryPage() {
  const { data, loading, error, refetch } = useInventoryMatrix();
  const [active, setActive] = useState<{ cell: MatrixCell; units?: CellUnit[]; loading: boolean } | null>(null);

  async function openCell(cell: MatrixCell) {
    setActive({ cell, loading: true });
    try {
      const units = await fetchCellUnits(cell.bloodGroup, cell.componentType);
      setActive({ cell, units, loading: false });
    } catch {
      setActive({ cell, units: [], loading: false });
    }
  }

  const cellAt = (g: string, t: string) => data?.cells.find((c) => c.bloodGroup === g && c.componentType === t);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Real-time stock by blood group and component. Colour shows the stock level."
        actions={
          data ? <Badge variant="default">{data.totalAvailable} units available</Badge> : undefined
        }
      />

      {loading ? (
        <ListSkeleton rows={8} />
      ) : error ? (
        <ErrorState description="Could not load inventory." onRetry={refetch} />
      ) : data ? (
        <Card className="overflow-x-auto p-4">
          <table className="w-full border-separate border-spacing-1 text-center text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground">Group</th>
                {data.componentTypes.map((t) => (
                  <th key={t} className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {COMPONENT_LABEL[t] ?? t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.groups.map((g) => (
                <tr key={g}>
                  <td className="px-2 py-1 text-left font-medium">{groupLabel(g)}</td>
                  {data.componentTypes.map((t) => {
                    const cell = cellAt(g, t);
                    if (!cell) return <td key={t} />;
                    return (
                      <td key={t}>
                        <button
                          onClick={() => openCell(cell)}
                          className={cn(
                            "flex h-12 w-full min-w-14 items-center justify-center rounded-md font-semibold transition-transform hover:scale-[1.03]",
                            LEVEL_CLASS[cell.level],
                          )}
                          title={`${groupLabel(g)} ${COMPONENT_LABEL[t] ?? t}: ${cell.available} available`}
                        >
                          {cell.available}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-destructive/40" /> Critical</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-warning/40" /> Low</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-success/40" /> OK</span>
          </div>
        </Card>
      ) : null}

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent>
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {groupLabel(active.cell.bloodGroup)}{" "}
                  <Badge variant="primary">{COMPONENT_LABEL[active.cell.componentType]}</Badge>
                </SheetTitle>
                <SheetDescription>
                  {active.cell.available} available · {active.cell.reserved} reserved
                </SheetDescription>
              </SheetHeader>
              {active.loading ? (
                <ListSkeleton rows={4} />
              ) : active.units && active.units.length > 0 ? (
                <ul className="divide-y text-sm">
                  {active.units.map((u) => (
                    <li key={u.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="font-medium">{u.barcode}</div>
                        <div className="text-xs text-muted-foreground">
                          bag {u.unit.bagNumber} · {u.storageLocation ?? "—"}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <Badge variant={u.status === "AVAILABLE" ? "success" : "default"}>{u.status}</Badge>
                        <div className="mt-1">exp {u.expiresAt.slice(0, 10)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No units in this cell.</p>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

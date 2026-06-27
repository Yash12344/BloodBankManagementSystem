import { Button } from "@bloodline/ui";
import { Heart } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-card bg-primary/10 text-primary">
        <Heart className="size-6 fill-current" />
      </span>
      <h1 className="text-3xl font-semibold">BloodLine</h1>
      <p className="max-w-md text-muted-foreground">
        Blood Bank Management System — run your blood bank without paperwork.
      </p>
      <Button asChild>
        <Link href="/dashboard">Open dashboard</Link>
      </Button>
    </main>
  );
}

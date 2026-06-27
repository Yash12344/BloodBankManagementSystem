export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-card bg-accent-soft text-2xl text-accent">
        ♥
      </span>
      <h1 className="text-3xl font-semibold">BloodLine</h1>
      <p className="max-w-md text-zinc-500">
        Blood Bank Management System — foundation is up. The dashboard and modules arrive in
        the next phases per the roadmap.
      </p>
      <code className="rounded-card bg-zinc-100 px-3 py-1 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
        Phase 1 · skeleton running
      </code>
    </main>
  );
}

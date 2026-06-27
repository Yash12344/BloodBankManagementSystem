"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login, verifyOtp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (challengeId) {
        await verifyOtp(challengeId, code);
        router.push("/dashboard");
        return;
      }
      const res = await login(email, password);
      if (res.mfaRequired) setChallengeId(res.challengeId);
      else router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-card border border-zinc-200 bg-white p-8 shadow-card dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-card bg-accent-soft text-lg text-accent">
            ♥
          </span>
          <h1 className="text-xl font-semibold">BloodLine</h1>
        </div>

        {!challengeId ? (
          <>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-[10px] border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-accent dark:border-zinc-700 dark:bg-zinc-900"
            />
            <label className="mb-1 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-4 w-full rounded-[10px] border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-accent dark:border-zinc-700 dark:bg-zinc-900"
            />
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-zinc-500">Enter the 6-digit code sent to your email.</p>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="mb-4 w-full rounded-[10px] border border-zinc-300 px-3 py-2 text-center text-lg tracking-[0.5em] outline-none focus:border-accent dark:border-zinc-700 dark:bg-zinc-900"
            />
          </>
        )}

        {error && <p className="mb-3 text-sm text-accent">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-[10px] bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? "Please wait…" : challengeId ? "Verify code" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

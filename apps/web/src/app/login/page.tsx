"use client";

import { Button, Card, Input, Label } from "@bloodline/ui";
import { Heart } from "lucide-react";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      {/* Soft brand glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]"
      />
      <Card className="relative w-full max-w-sm p-8 shadow-lg animate-slide-up">
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-card bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Heart className="size-5 fill-current" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">BloodLine</h1>
            <p className="text-xs text-muted-foreground">Blood Bank Management System</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {!challengeId ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="otp">Verification code</Label>
              <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to your email.</p>
              <Input
                id="otp"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-[0.5em]"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Please wait…" : challengeId ? "Verify code" : "Sign in"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

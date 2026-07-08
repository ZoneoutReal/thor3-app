"use client";

import { useState } from "react";
import { pullAll, type Snapshot } from "@/lib/sync";
import { setPasscode, setProfileId, type Profile } from "@/lib/profiles";

// First-run gate: enter the shared family passcode, then pick who's training on
// this device. Shown until both are set; also reused to switch profiles.
export function Gate({
  initialStep = "code",
  knownProfiles,
  onUnlock,
  onClose,
}: {
  initialStep?: "code" | "pick";
  knownProfiles?: Profile[];
  onUnlock: (snapshot: Snapshot | null) => void;
  onClose?: () => void;
}) {
  const [step, setStep] = useState<"code" | "pick">(initialStep);
  const [code, setCode] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>(knownProfiles ?? []);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    const r = await pullAll(code.trim());
    setLoading(false);
    if (!r.ok || !r.snapshot) {
      setError(r.error === "unauthorized" ? "That code doesn't match. Try again." : "Couldn't reach the server. Check your connection.");
      return;
    }
    setPasscode(code.trim());
    setProfiles(r.snapshot.profiles);
    setSnapshot(r.snapshot);
    setStep("pick");
  }

  function pick(p: Profile) {
    setProfileId(p.id);
    onUnlock(snapshot);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-xs">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            THOR<span style={{ color: "var(--accent)" }}>3</span>
          </h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-[var(--muted)]">SFAS Conditioning</p>
        </div>

        {step === "code" ? (
          <form onSubmit={submitCode} className="space-y-3">
            <label className="block text-sm font-medium text-[var(--foreground)]">Family code</label>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Enter your shared code"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center text-lg tracking-wide text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full rounded-lg py-3 text-sm font-semibold transition-colors disabled:opacity-40"
              style={{ backgroundColor: "var(--accent)", color: "#000" }}
            >
              {loading ? "Checking..." : "Continue"}
            </button>
            <p className="pt-2 text-center text-xs text-[var(--muted)]">
              Shared by you and your training partner.
            </p>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm font-medium text-[var(--foreground)]">Who&apos;s training?</p>
            <div className="space-y-2">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p)}
                  className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--card-hover)]"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{ backgroundColor: "var(--accent)" + "22", color: "var(--accent)" }}
                  >
                    {p.display_name.slice(0, 1)}
                  </span>
                  <span className="text-base font-semibold text-[var(--foreground)]">{p.display_name}</span>
                </button>
              ))}
            </div>
            {onClose && (
              <button onClick={onClose} className="w-full py-2 text-center text-xs text-[var(--muted)]">
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Smart donor suggestion ranking — deterministic and explainable. Given a needed blood
 * group and a pool of eligible donors, score each by group match, donation recency, and
 * reliability (donation count). No LLM required.
 */
export interface DonorCandidate {
  id: string;
  name: string;
  bloodGroup: string;
  donationCount: number;
  lastDonationAt: Date | null;
  nextEligibleAt: Date | null;
}

export interface ScoredDonor extends DonorCandidate {
  score: number;
  reasons: string[];
}

// O-negative is the universal red-cell donor; weight exact matches highest, then O-neg.
function groupScore(candidate: string, needed: string): { score: number; reason: string } | null {
  if (candidate === needed) return { score: 100, reason: "Exact group match" };
  if (candidate === "O_NEG") return { score: 60, reason: "Universal donor (O-)" };
  return null;
}

export function rankDonors(candidates: DonorCandidate[], neededGroup: string, now: Date = new Date()): ScoredDonor[] {
  const scored: ScoredDonor[] = [];
  for (const c of candidates) {
    // Skip donors not yet eligible.
    if (c.nextEligibleAt && c.nextEligibleAt > now) continue;
    const gs = groupScore(c.bloodGroup, neededGroup);
    if (!gs) continue;

    const reasons = [gs.reason];
    let score = gs.score;

    // Reliability: more prior donations = more dependable (capped contribution).
    const reliability = Math.min(20, c.donationCount * 2);
    score += reliability;
    if (c.donationCount > 0) reasons.push(`${c.donationCount} prior donation(s)`);

    // Recency: donors who haven't donated in a while are more likely available; very recent
    // donors slightly deprioritised.
    if (c.lastDonationAt) {
      const days = (now.getTime() - c.lastDonationAt.getTime()) / 86_400_000;
      if (days > 180) {
        score += 10;
        reasons.push("Not donated in 6+ months");
      }
    } else {
      score += 5;
      reasons.push("First-time donor");
    }

    scored.push({ ...c, score: Math.round(score), reasons });
  }
  return scored.sort((a, b) => b.score - a.score);
}

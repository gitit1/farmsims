export type NeedKey = "hunger" | "energy" | "hygiene" | "fun" | "social";

export interface NeedsState {
  hunger: number;
  energy: number;
  hygiene: number;
  fun: number;
  social: number;
}

export interface NeedsDecay {
  hunger: number;
  energy: number;
  hygiene: number;
  fun: number;
  social: number;
}

export function createNeeds(): NeedsState {
  return {
    hunger: 100,
    energy: 100,
    hygiene: 100,
    fun: 100,
    social: 100
  };
}

export function applyNeedsDecay(needs: NeedsState, decay: NeedsDecay, simMinutes: number): void {
  needs.hunger = clamp(needs.hunger - decay.hunger * simMinutes, 0, 100);
  needs.energy = clamp(needs.energy - decay.energy * simMinutes, 0, 100);
  needs.hygiene = clamp(needs.hygiene - decay.hygiene * simMinutes, 0, 100);
  needs.fun = clamp(needs.fun - decay.fun * simMinutes, 0, 100);
  needs.social = clamp(needs.social - decay.social * simMinutes, 0, 100);
}

export function getSpeedMultiplier(needs: NeedsState): number {
  let multiplier = 1;
  if (needs.energy < 15) {
    multiplier *= 0.6;
  }
  if (needs.hunger < 15) {
    multiplier *= 0.8;
  }
  return multiplier;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

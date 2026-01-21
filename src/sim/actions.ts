import type { NeedsState } from "./needs";
import type { NeedKey } from "./needs";

export interface Action {
  id: string;
  label: string;
  durationMinutes: number;
  needsDelta: Partial<Record<NeedKey, number>>;
}

export interface ActiveAction {
  action: Action;
  remainingMinutes: number;
}

export const DEFAULT_ACTIONS: Action[] = [
  {
    id: "rest",
    label: "Rest",
    durationMinutes: 30,
    needsDelta: {
      energy: 15,
      hunger: -3,
      hygiene: -2
    }
  },
  {
    id: "snack",
    label: "Snack",
    durationMinutes: 15,
    needsDelta: {
      hunger: 10,
      energy: -1
    }
  },
  {
    id: "wash",
    label: "Wash",
    durationMinutes: 20,
    needsDelta: {
      hygiene: 20,
      fun: -1
    }
  }
];

export const DEFAULT_ACTION_HOTKEYS: Record<string, string> = {
  Digit1: "rest",
  Numpad1: "rest",
  Digit2: "snack",
  Numpad2: "snack",
  Digit3: "wash",
  Numpad3: "wash"
};

export const DEFAULT_ACTION_BUTTONS: string[] = ["rest", "snack", "wash"];

export function buildActionIndex(actions: Action[]): Record<string, Action> {
  const index: Record<string, Action> = {};
  for (const action of actions) {
    if (!index[action.id]) {
      index[action.id] = action;
    }
  }
  return index;
}

export function getActionById(index: Record<string, Action>, id: string): Action | null {
  return index[id] ?? null;
}

export class ActionQueue {
  private active: ActiveAction | null = null;

  startAction(action: Action): boolean {
    if (this.active) {
      return false;
    }
    this.active = {
      action,
      remainingMinutes: action.durationMinutes
    };
    return true;
  }

  tick(simMinutes: number, needs: NeedsState): void {
    if (!this.active || simMinutes <= 0) {
      return;
    }

    const consume = Math.min(simMinutes, this.active.remainingMinutes);
    applyActionNeeds(needs, this.active.action, consume);
    this.active.remainingMinutes -= consume;

    if (this.active.remainingMinutes <= 0) {
      this.active = null;
    }
  }

  isActive(): boolean {
    return this.active !== null;
  }

  getActive(): ActiveAction | null {
    return this.active;
  }
}

function applyActionNeeds(needs: NeedsState, action: Action, minutes: number): void {
  const duration = Math.max(1, action.durationMinutes);
  const perMinute = minutes / duration;
  for (const key of Object.keys(action.needsDelta) as NeedKey[]) {
    const delta = action.needsDelta[key];
    if (typeof delta === "number") {
      needs[key] = clamp(needs[key] + delta * perMinute, 0, 100);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

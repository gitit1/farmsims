import type { NeedKey } from "../sim/needs";
import { DEFAULT_ACTIONS, DEFAULT_ACTION_BUTTONS, DEFAULT_ACTION_HOTKEYS, type Action } from "../sim/actions";
import { DEFAULT_CROPS, type CropDefinition } from "../sim/farm";
import { DEFAULT_SHOP_ITEMS, type ShopItem } from "../sim/shop";

export interface ContentConfig {
  crops: CropDefinition[];
  actions: Action[];
  actionHotkeys: Record<string, string>;
  actionButtons: string[];
  shopItems: ShopItem[];
}

export async function loadContent(): Promise<ContentConfig> {
  const [cropsData, actionsData, shopData] = await Promise.all([
    fetchJson("data/crops.json"),
    fetchJson("data/actions.json"),
    fetchJson("data/shop_items.json")
  ]);

  const crops = validateCrops(cropsData) ?? DEFAULT_CROPS;
  const actionsBlock = validateActions(actionsData);
  const actions = actionsBlock?.actions ?? DEFAULT_ACTIONS;
  const actionHotkeys = actionsBlock?.hotkeys ?? DEFAULT_ACTION_HOTKEYS;
  const actionButtons = actionsBlock?.buttons ?? DEFAULT_ACTION_BUTTONS;
  const shopItems = validateShopItems(shopData) ?? DEFAULT_SHOP_ITEMS;

  return {
    crops,
    actions,
    actionHotkeys,
    actionButtons,
    shopItems
  };
}

async function fetchJson(path: string): Promise<unknown | null> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      console.warn(`[Content] Failed to load ${path} (${response.status}). Using defaults.`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`[Content] Failed to load ${path}. Using defaults.`, error);
    return null;
  }
}

function validateCrops(data: unknown): CropDefinition[] | null {
  if (!data) {
    return null;
  }
  if (!isRecord(data) || !Array.isArray(data.crops)) {
    console.warn("[Content] Invalid crops.json shape. Using defaults.");
    return null;
  }
  const valid: CropDefinition[] = [];
  const seen = new Set<string>();
  for (const entry of data.crops) {
    if (!isRecord(entry)) {
      continue;
    }
    const id = asString(entry.id);
    const name = asString(entry.name);
    const growthMinutes = asNumber(entry.growthMinutes);
    if (!id || !name || !isFiniteNumber(growthMinutes) || growthMinutes <= 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    valid.push({ id, name, growthMinutes });
  }
  if (valid.length === 0) {
    console.warn("[Content] crops.json had no valid crops. Using defaults.");
    return null;
  }
  if (valid.length !== data.crops.length) {
    console.warn("[Content] Some crops.json entries were invalid and ignored.");
  }
  return valid;
}

function validateActions(
  data: unknown
): { actions: Action[]; hotkeys: Record<string, string>; buttons: string[] } | null {
  if (!data) {
    return null;
  }
  if (!isRecord(data) || !Array.isArray(data.actions)) {
    console.warn("[Content] Invalid actions.json shape. Using defaults.");
    return null;
  }
  const actions: Action[] = [];
  const seen = new Set<string>();
  for (const entry of data.actions) {
    if (!isRecord(entry)) {
      continue;
    }
    const id = asString(entry.id);
    const label = asString(entry.label);
    const durationMinutes = asNumber(entry.durationMinutes);
    const needsDelta = parseNeedsDelta(entry.needsDelta);
    if (!id || !label || !isFiniteNumber(durationMinutes) || durationMinutes <= 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    actions.push({
      id,
      label,
      durationMinutes,
      needsDelta
    });
  }
  if (actions.length === 0) {
    console.warn("[Content] actions.json had no valid actions. Using defaults.");
    return null;
  }
  if (actions.length !== data.actions.length) {
    console.warn("[Content] Some actions.json entries were invalid and ignored.");
  }
  const actionIds = new Set(actions.map((action) => action.id));
  const hotkeys = parseHotkeys(data.hotkeys, actionIds);
  const buttons = parseButtons(data.buttons, actions, actionIds);
  return { actions, hotkeys, buttons };
}

function validateShopItems(data: unknown): ShopItem[] | null {
  if (!data) {
    return null;
  }
  if (!isRecord(data) || !Array.isArray(data.items)) {
    console.warn("[Content] Invalid shop_items.json shape. Using defaults.");
    return null;
  }
  const valid: ShopItem[] = [];
  const seen = new Set<string>();
  for (const entry of data.items) {
    if (!isRecord(entry)) {
      continue;
    }
    const id = asString(entry.id);
    const name = asString(entry.name);
    const description = asString(entry.description);
    const category = asString(entry.category);
    const priceBuy = asNumber(entry.priceBuy);
    const priceSell = asNumber(entry.priceSell);
    const iconLabel = asString(entry.iconLabel);
    const iconColor = asString(entry.iconColor);
    if (
      !id ||
      !name ||
      !description ||
      !category ||
      !isFiniteNumber(priceBuy) ||
      !isFiniteNumber(priceSell) ||
      !iconLabel ||
      !iconColor ||
      seen.has(id)
    ) {
      continue;
    }
    seen.add(id);
    valid.push({
      id,
      name,
      description,
      category,
      priceBuy,
      priceSell,
      iconLabel,
      iconColor
    });
  }
  if (valid.length === 0) {
    console.warn("[Content] shop_items.json had no valid items. Using defaults.");
    return null;
  }
  if (valid.length !== data.items.length) {
    console.warn("[Content] Some shop_items.json entries were invalid and ignored.");
  }
  return valid;
}

function parseNeedsDelta(value: unknown): Partial<Record<NeedKey, number>> {
  const allowed: NeedKey[] = ["hunger", "energy", "hygiene", "fun", "social"];
  if (!isRecord(value)) {
    return {};
  }
  const delta: Partial<Record<NeedKey, number>> = {};
  for (const key of allowed) {
    const amount = value[key];
    if (typeof amount === "number" && Number.isFinite(amount)) {
      delta[key] = amount;
    }
  }
  return delta;
}

function parseHotkeys(data: unknown, actionIds: Set<string>): Record<string, string> {
  const hotkeys: Record<string, string> = {};
  if (!isRecord(data)) {
    return filterHotkeys(DEFAULT_ACTION_HOTKEYS, actionIds);
  }
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && actionIds.has(value)) {
      hotkeys[key] = value;
    }
  }
  if (Object.keys(hotkeys).length === 0) {
    return filterHotkeys(DEFAULT_ACTION_HOTKEYS, actionIds);
  }
  return hotkeys;
}

function parseButtons(data: unknown, actions: Action[], actionIds: Set<string>): string[] {
  if (!Array.isArray(data)) {
    const fallback = DEFAULT_ACTION_BUTTONS.filter((id) => actionIds.has(id));
    return fallback.length > 0 ? fallback : actions.slice(0, 3).map((action) => action.id);
  }
  const buttons = data.filter((id) => typeof id === "string" && actionIds.has(id));
  if (buttons.length === 0) {
    const fallback = DEFAULT_ACTION_BUTTONS.filter((id) => actionIds.has(id));
    return fallback.length > 0 ? fallback : actions.slice(0, 3).map((action) => action.id);
  }
  return buttons;
}

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Number.NaN;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function filterHotkeys(source: Record<string, string>, actionIds: Set<string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (actionIds.has(value)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

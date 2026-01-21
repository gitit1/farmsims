export type ShopMode = "buy" | "sell";

export interface ShopState {
  isOpen: boolean;
  mode: ShopMode;
  selectedIndex: number;
  quantity: number;
  pageIndex: number;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: string;
  priceBuy: number;
  priceSell: number;
  iconLabel: string;
  iconColor: string;
}

export const DEFAULT_SHOP_ITEMS: ShopItem[] = [
  {
    id: "carrot_seed",
    name: "Carrot Seeds",
    description: "Quick-growing roots. Reliable starter crop.",
    category: "Seed",
    priceBuy: 15,
    priceSell: 6,
    iconLabel: "C",
    iconColor: "#e58b4a"
  },
  {
    id: "potato_seed",
    name: "Potato Seeds",
    description: "Sturdy sprouts that love steady watering.",
    category: "Seed",
    priceBuy: 20,
    priceSell: 8,
    iconLabel: "P",
    iconColor: "#c29a6b"
  },
  {
    id: "strawberry_seed",
    name: "Strawberry Seeds",
    description: "Sweet berries with a slower grow cycle.",
    category: "Seed",
    priceBuy: 30,
    priceSell: 12,
    iconLabel: "S",
    iconColor: "#de5e7d"
  },
  {
    id: "gift_trinket",
    name: "Gift Trinket",
    description: "A small charm to brighten someone's day.",
    category: "Gift",
    priceBuy: 45,
    priceSell: 20,
    iconLabel: "G",
    iconColor: "#6a9ac7"
  }
];

export function createShopState(): ShopState {
  return {
    isOpen: false,
    mode: "buy",
    selectedIndex: 0,
    quantity: 1,
    pageIndex: 0
  };
}

export function getMaxShopQuantity(mode: ShopMode, item: ShopItem | null, money: number, owned: number): number {
  const cap = 99;
  if (!item) {
    return 1;
  }
  if (mode === "buy") {
    if (item.priceBuy <= 0) {
      return cap;
    }
    const affordable = Math.floor(money / item.priceBuy);
    return clamp(Math.max(1, affordable), 1, cap);
  }
  return clamp(Math.max(1, owned), 1, cap);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

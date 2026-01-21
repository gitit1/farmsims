import type { SimTime } from "./clock";
import type { NeedsState } from "./needs";
import { createNeeds } from "./needs";
import { ActionQueue } from "./actions";
import type { FarmState, CropCatalog } from "./farm";
import { createFarmState } from "./farm";
import { createInventory, type InventoryState } from "./inventory";
import { createShopState, type ShopState } from "./shop";

export interface SimState {
  time: SimTime;
  money: number;
  needs: NeedsState;
  actionQueue: ActionQueue;
  farm: FarmState;
  inventory: InventoryState;
  shop: ShopState;
}

export function createSimState(crops: CropCatalog): SimState {
  return {
    time: {
      day: 1,
      hour: 8,
      minute: 0
    },
    money: 100,
    needs: createNeeds(),
    actionQueue: new ActionQueue(),
    farm: createFarmState(crops),
    inventory: createInventory(),
    shop: createShopState()
  };
}

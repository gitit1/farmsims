export interface InventoryState {
  items: Record<string, number>;
}

export function createInventory(): InventoryState {
  return {
    items: {}
  };
}

export function getItemCount(inventory: InventoryState, id: string): number {
  return inventory.items[id] ?? 0;
}

export function addItem(inventory: InventoryState, id: string, amount: number = 1): void {
  if (amount <= 0) {
    return;
  }
  inventory.items[id] = getItemCount(inventory, id) + amount;
}

export function removeItem(inventory: InventoryState, id: string, amount: number = 1): boolean {
  if (amount <= 0) {
    return true;
  }
  const current = getItemCount(inventory, id);
  if (current < amount) {
    return false;
  }
  const next = current - amount;
  if (next <= 0) {
    delete inventory.items[id];
  } else {
    inventory.items[id] = next;
  }
  return true;
}

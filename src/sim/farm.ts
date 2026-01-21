import { FARM_PATCH } from "../world/layout";

export type SoilState = "empty" | "tilled" | "watered";
export type CropType = string;

export interface CropDefinition {
  id: CropType;
  name: string;
  growthMinutes: number;
}

export interface CropCatalog {
  list: CropDefinition[];
  byId: Record<string, CropDefinition>;
}

export interface PlotState {
  soilState: SoilState;
  cropType: CropType | null;
  growthMinutes: number;
}

export interface FarmState {
  plots: Map<string, PlotState>;
  crops: CropCatalog;
}

export const DEFAULT_CROPS: CropDefinition[] = [
  {
    id: "carrot",
    name: "Carrot",
    growthMinutes: 240
  },
  {
    id: "potato",
    name: "Potato",
    growthMinutes: 360
  },
  {
    id: "strawberry",
    name: "Strawberry",
    growthMinutes: 480
  }
];

export function createCropCatalog(crops: CropDefinition[]): CropCatalog {
  const list = crops.length > 0 ? crops : DEFAULT_CROPS;
  const byId: Record<string, CropDefinition> = {};
  for (const crop of list) {
    if (!byId[crop.id]) {
      byId[crop.id] = crop;
    }
  }
  return { list, byId };
}

export function createFarmState(crops: CropCatalog): FarmState {
  const plots = new Map<string, PlotState>();
  for (let y = FARM_PATCH.y; y < FARM_PATCH.y + FARM_PATCH.h; y += 1) {
    for (let x = FARM_PATCH.x; x < FARM_PATCH.x + FARM_PATCH.w; x += 1) {
      plots.set(keyFor(x, y), {
        soilState: "empty",
        cropType: null,
        growthMinutes: 0
      });
    }
  }
  return { plots, crops };
}

export function getPlot(farm: FarmState, tx: number, ty: number): PlotState | null {
  return farm.plots.get(keyFor(tx, ty)) ?? null;
}

export function tickFarmGrowth(farm: FarmState, simMinutes: number): void {
  if (simMinutes <= 0) {
    return;
  }
  for (const plot of farm.plots.values()) {
    if (plot.soilState !== "watered" || !plot.cropType) {
      continue;
    }
    const total = getCropGrowthMinutes(farm, plot.cropType);
    if (total <= 0) {
      continue;
    }
    plot.growthMinutes = clamp(plot.growthMinutes + simMinutes, 0, total);
  }
}

export function getGrowthPercent(farm: FarmState, plot: PlotState): number {
  if (!plot.cropType) {
    return 0;
  }
  const total = getCropGrowthMinutes(farm, plot.cropType);
  if (total <= 0) {
    return 0;
  }
  return clamp(plot.growthMinutes / total, 0, 1);
}

export function getGrowthStage(farm: FarmState, plot: PlotState): number {
  if (!plot.cropType) {
    return 0;
  }
  const percent = getGrowthPercent(farm, plot);
  return Math.min(3, Math.floor(percent * 4));
}

export function isHarvestable(farm: FarmState, plot: PlotState): boolean {
  if (!plot.cropType) {
    return false;
  }
  const total = getCropGrowthMinutes(farm, plot.cropType);
  if (total <= 0) {
    return false;
  }
  return plot.growthMinutes >= total;
}

export function resetPlotToTilled(plot: PlotState): void {
  plot.soilState = "tilled";
  plot.cropType = null;
  plot.growthMinutes = 0;
}

export function setPlotWatered(plot: PlotState): void {
  plot.soilState = "watered";
}

export function setPlotTilled(plot: PlotState): void {
  plot.soilState = "tilled";
  plot.cropType = null;
  plot.growthMinutes = 0;
}

export function plantCrop(plot: PlotState, cropType: CropType): void {
  plot.cropType = cropType;
  plot.growthMinutes = 0;
}

export function getCropDefinition(farm: FarmState, cropType: CropType): CropDefinition | null {
  return farm.crops.byId[cropType] ?? null;
}

function getCropGrowthMinutes(farm: FarmState, cropType: CropType): number {
  const def = getCropDefinition(farm, cropType);
  return def ? def.growthMinutes : 0;
}

function keyFor(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

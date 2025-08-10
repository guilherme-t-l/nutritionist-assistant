export type Unit =
  | "g"
  | "kg"
  | "mg"
  | "lb"
  | "oz"
  | "ml"
  | "l"
  | "tsp"
  | "tbsp"
  | "cup"
  | "piece";

const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
  lb: 453.59237,
  oz: 28.349523125,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 240, // US legal cup approximation for nutrition labels
};

export function isMassUnit(unit: Unit): boolean {
  return unit in MASS_TO_GRAMS;
}

export function isVolumeUnit(unit: Unit): boolean {
  return unit in VOLUME_TO_ML;
}

export function toGrams(quantity: number, unit: Unit): number {
  if (!isMassUnit(unit)) {
    throw new Error(`Unit ${unit} is not a mass unit`);
  }
  return quantity * MASS_TO_GRAMS[unit];
}

export function toMilliliters(quantity: number, unit: Unit): number {
  if (!isVolumeUnit(unit)) {
    throw new Error(`Unit ${unit} is not a volume unit`);
  }
  return quantity * VOLUME_TO_ML[unit];
}

/**
 * Convert an arbitrary portion to grams using density when needed.
 * If unit is volume, requires densityGPerMl.
 */
export function portionToGrams(
  quantity: number,
  unit: Unit,
  densityGPerMl?: number
): number {
  if (isMassUnit(unit)) return toGrams(quantity, unit);
  if (isVolumeUnit(unit)) {
    if (densityGPerMl == null) {
      throw new Error("Density required to convert volume to grams");
    }
    const ml = toMilliliters(quantity, unit);
    return ml * densityGPerMl;
  }
  if (unit === "piece") {
    throw new Error("'piece' requires a per-piece gram equivalence provided elsewhere");
  }
  throw new Error(`Unsupported unit: ${unit}`);
}


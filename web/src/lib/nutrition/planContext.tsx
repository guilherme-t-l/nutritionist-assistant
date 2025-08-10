"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import type { MealItemInput } from "./types";

export type MealKey = "Breakfast" | "Lunch" | "Dinner" | "Snacks";

export const DEFAULT_MEALS: MealKey[] = ["Breakfast", "Lunch", "Dinner", "Snacks"];

export type MealPlanState = Record<MealKey, MealItemInput[]>;

export interface PlanDocState {
  doc: string; // free-form text resembling a doc
  setDoc: React.Dispatch<React.SetStateAction<string>>;
}

const EMPTY_PLAN: MealPlanState = {
  Breakfast: [],
  Lunch: [],
  Dinner: [],
  Snacks: [],
};

interface PlanContextValue {
  plan: MealPlanState;
  setPlan: React.Dispatch<React.SetStateAction<MealPlanState>>;
  addItem: (meal: MealKey, item: MealItemInput) => void;
  removeItem: (meal: MealKey, index: number) => void;
  updateItem: (meal: MealKey, index: number, changes: Partial<MealItemInput>) => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);
const PlanDocContext = createContext<PlanDocState | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<MealPlanState>(EMPTY_PLAN);
  const [doc, setDoc] = useState<string>(
    `Meal Plan\n\nBreakfast:\n- oats_rolled 50 g\n- milk_skim 240 ml\n\nLunch:\n- egg_whole 2 piece\n\nDinner:\n\nSnacks:`
  );

  const value = useMemo<PlanContextValue>(() => ({
    plan,
    setPlan,
    addItem: (meal, item) =>
      setPlan((prev) => ({
        ...prev,
        [meal]: [...prev[meal], item],
      })),
    removeItem: (meal, index) =>
      setPlan((prev) => ({
        ...prev,
        [meal]: prev[meal].filter((_, i) => i !== index),
      })),
    updateItem: (meal, index, changes) =>
      setPlan((prev) => ({
        ...prev,
        [meal]: prev[meal].map((it, i) => (i === index ? { ...it, ...changes } : it)),
      })),
  }), [plan]);

  return (
    <PlanDocContext.Provider value={{ doc, setDoc }}>
      <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
    </PlanDocContext.Provider>
  );
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}

export function usePlanDoc(): PlanDocState {
  const ctx = useContext(PlanDocContext);
  if (!ctx) throw new Error("usePlanDoc must be used within PlanProvider");
  return ctx;
}


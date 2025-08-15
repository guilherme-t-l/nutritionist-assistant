"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlan, usePlanDoc, DEFAULT_MEALS, type MealKey } from "@/lib/nutrition/planContext";
import { MacroEngine } from "@/lib/nutrition/macroEngine";
import { FOODS_FIXTURE, PIECE_MAP } from "@/lib/nutrition/fixtures";
import type { AggregatedMacros } from "@/lib/nutrition/types";

// Very simple parser: lines under a meal header like `Breakfast:` with `- <foodId> <qty> <unit>`
function parseDoc(doc: string): Record<MealKey, { foodId: string; quantity: number; unit: string }[]> {
  const lines = doc.split(/\r?\n/);
  const result: Record<MealKey, any[]> = { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] };
  let current: MealKey | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const header = line.replace(/:$/, "");
    if (DEFAULT_MEALS.includes(header as MealKey)) {
      current = header as MealKey;
      continue;
    }
    if (!current) continue;
    const m = line.match(/^-[\s]+(\S+)\s+(\d+(?:\.\d+)?)\s+(g|ml|piece)$/i);
    if (m) {
      result[current].push({ foodId: m[1], quantity: Number(m[2]), unit: m[3].toLowerCase() });
    }
  }
  return result;
}

export default function PlanDocEditor() {
  const { plan } = usePlan();
  const { doc, setDoc } = usePlanDoc();
  const [macros, setMacros] = useState<{ total: AggregatedMacros; perMeal: AggregatedMacros[] }>({
    total: { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 },
    perMeal: []
  });
  
  const engine = useMemo(() => new MacroEngine(FOODS_FIXTURE, { pieceToGramMap: PIECE_MAP }), []);

  const parsed = useMemo(() => parseDoc(doc), [doc]);
  const mealsArray = useMemo(() => DEFAULT_MEALS.map((m) => parsed[m].map((it) => ({ foodId: it.foodId, portion: { quantity: it.quantity, unit: it.unit } }))), [parsed]);
  
  // Compute macros asynchronously
  useEffect(() => {
    const computeMacros = async () => {
      try {
        const computedMacros = await engine.computeDayMacros(mealsArray);
        setMacros(computedMacros);
      } catch (error) {
        console.error('Error computing macros:', error);
        // Set default values on error
        setMacros({
          total: { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 },
          perMeal: []
        });
      }
    };
    
    computeMacros();
  }, [engine, mealsArray]);

  useEffect(() => {
    // Sync if provider state changes later (future enhancement)
  }, [plan]);

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 w-full">
      <div className="text-sm text-slate-300">Plan Document</div>
      <textarea
        className="flex-1 min-h-0 bg-slate-900/70 border border-white/10 rounded-lg p-3 font-mono text-sm leading-5 resize-none"
        value={doc}
        onChange={(e) => setDoc(e.target.value)}
      />
      <div className="bg-slate-900/70 border border-white/10 rounded-lg p-3">
        <div className="text-sm text-slate-300 mb-1">Daily Total</div>
        <div className="text-sm">
          kcal {macros.total.caloriesKcal.toFixed(0)} · Protein {macros.total.proteinG.toFixed(1)} g · Carbs {macros.total.carbsG.toFixed(1)} g · Fat {macros.total.fatG.toFixed(1)} g
        </div>
      </div>
    </div>
  );
}


"use client";

import { useMemo, useState } from "react";
import { MacroEngine } from "@/lib/nutrition/macroEngine";
import { FOODS_FIXTURE, PIECE_MAP } from "@/lib/nutrition/fixtures";
import type { MealItemInput } from "@/lib/nutrition/types";
import { DEFAULT_MEALS, usePlan, type MealKey } from "@/lib/nutrition/planContext";

type UnitOption = "g" | "ml" | "piece";

export default function PlanPanel() {
  const { plan, addItem: addItemCtx, removeItem: removeItemCtx, updateItem: updateItemCtx } = usePlan();

  const [newMeal, setNewMeal] = useState<MealKey>("Breakfast");
  const [newFoodId, setNewFoodId] = useState<string>(FOODS_FIXTURE[0]?.id ?? "");
  const [newQuantity, setNewQuantity] = useState<number>(100);
  const [newUnit, setNewUnit] = useState<UnitOption>("g");

  const engine = useMemo(() => new MacroEngine(FOODS_FIXTURE, { pieceToGramMap: PIECE_MAP }), []);

  const mealsArray = useMemo(() => DEFAULT_MEALS.map((m) => plan[m] ?? []), [plan]);

  const macros = useMemo(() => engine.computeDayMacros(mealsArray), [engine, mealsArray]);

  const addItem = () => {
    if (!newFoodId) return;
    const item: MealItemInput = {
      foodId: newFoodId,
      portion: { quantity: Number(newQuantity) || 0, unit: newUnit },
    };
    addItemCtx(newMeal, item);
  };

  const removeItem = (meal: MealKey, index: number) => {
    removeItemCtx(meal, index);
  };

  const updateItem = (meal: MealKey, index: number, changes: Partial<MealItemInput>) => {
    updateItemCtx(meal, index, changes);
  };

  return (
    <aside className="h-full flex flex-col gap-3">
      <div className="text-sm text-slate-300">Plan & Macros</div>
      <div className="bg-slate-900/70 border border-white/10 rounded-lg p-3 flex flex-col gap-2">
        <div className="grid grid-cols-4 gap-2">
          <select
            className="bg-slate-800 border border-white/10 rounded px-2 py-1"
            value={newMeal}
            onChange={(e) => setNewMeal(e.target.value as MealKey)}
            aria-label="Meal"
          >
            {DEFAULT_MEALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="bg-slate-800 border border-white/10 rounded px-2 py-1"
            value={newFoodId}
            onChange={(e) => setNewFoodId(e.target.value)}
            aria-label="Food"
          >
            {FOODS_FIXTURE.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <input
            className="bg-slate-800 border border-white/10 rounded px-2 py-1"
            type="number"
            min={0}
            step={1}
            value={newQuantity}
            onChange={(e) => setNewQuantity(Number(e.target.value))}
            aria-label="Quantity"
          />
          <select
            className="bg-slate-800 border border-white/10 rounded px-2 py-1"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value as UnitOption)}
            aria-label="Unit"
          >
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="piece">piece</option>
          </select>
        </div>
        <button
          className="self-start px-3 py-1.5 rounded bg-gradient-to-r from-cyan-400 to-violet-400 text-slate-900 font-semibold"
          onClick={addItem}
        >
          Add Item
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {DEFAULT_MEALS.map((meal) => (
          <div key={meal} className="bg-slate-900/70 border border-white/10 rounded-lg">
            <div className="px-3 py-2 border-b border-white/10 text-sm text-slate-300 flex items-center justify-between">
              <div>{meal}</div>
              <div className="text-xs text-slate-400">
                kcal {macros.perMeal[DEFAULT_MEALS.indexOf(meal)]?.caloriesKcal.toFixed(0)} · P
                {macros.perMeal[DEFAULT_MEALS.indexOf(meal)]?.proteinG.toFixed(1)} · C
                {macros.perMeal[DEFAULT_MEALS.indexOf(meal)]?.carbsG.toFixed(1)} · F
                {macros.perMeal[DEFAULT_MEALS.indexOf(meal)]?.fatG.toFixed(1)}
              </div>
            </div>
            <div className="p-3 space-y-2">
              {(plan[meal] ?? []).map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
                  <select
                    className="bg-slate-800 border border-white/10 rounded px-2 py-1"
                    value={item.foodId}
                    onChange={(e) => updateItem(meal, idx, { foodId: e.target.value })}
                    aria-label="Food"
                  >
                    {FOODS_FIXTURE.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-20 bg-slate-800 border border-white/10 rounded px-2 py-1"
                    type="number"
                    min={0}
                    step={1}
                    value={item.portion.quantity}
                    onChange={(e) =>
                      updateItem(meal, idx, { portion: { ...item.portion, quantity: Number(e.target.value) } })
                    }
                    aria-label="Quantity"
                  />
                  <select
                    className="w-24 bg-slate-800 border border-white/10 rounded px-2 py-1"
                    value={item.portion.unit}
                    onChange={(e) => updateItem(meal, idx, { portion: { ...item.portion, unit: e.target.value } })}
                    aria-label="Unit"
                  >
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="piece">piece</option>
                  </select>
                  <div className="text-xs text-slate-400 w-40">
                    {(() => {
                      try {
                        const m = engine.computeItemMacros(item.foodId, item.portion);
                        return `kcal ${m.caloriesKcal.toFixed(0)} · P${m.proteinG.toFixed(1)} C${m.carbsG.toFixed(1)} F${m.fatG.toFixed(1)}`;
                      } catch (e) {
                        return "—";
                      }
                    })()}
                  </div>
                  <button
                    className="justify-self-end text-red-300 hover:text-red-200 text-sm"
                    onClick={() => removeItem(meal, idx)}
                    aria-label="Remove"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {plan[meal]?.length === 0 && <div className="text-xs text-slate-500">No items</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900/70 border border-white/10 rounded-lg p-3">
        <div className="text-sm text-slate-300 mb-1">Daily Total</div>
        <div className="text-sm">
          kcal {macros.total.caloriesKcal.toFixed(0)} · Protein {macros.total.proteinG.toFixed(1)} g · Carbs {macros.total.carbsG.toFixed(1)} g · Fat {macros.total.fatG.toFixed(1)} g
        </div>
      </div>
    </aside>
  );
}


export const nutritionistSystemPrompt = `You are an AI nutritionist assistant. You help users with food choices, macro awareness, and balanced suggestions while strictly respecting any allergies/restrictions. You do not provide medical diagnosis or treatment. Keep responses practical, concise, and culturally sensitive. Ask clarifying questions when information is missing.

Key rules:
- Always check for preferences/allergies/cultural rules before suggesting foods.
- Ask for missing details (goals, calories, macro targets, budget, cuisine).
- Keep answers concise; offer follow-up options.
- Avoid prescriptive medical advice; include a brief disclaimer when appropriate.
- If unsure, ask for clarification rather than guessing.`;

export type BaseMessage = { role: "user" | "assistant"; content: string };

export function buildMessagesWithContext(
  userMessages: BaseMessage[],
  preferences?: {
    allergies?: string[];
    dislikes?: string[];
    cuisine?: string;
    budget?: "low" | "medium" | "high";
  },
  planDoc?: string
) {
  const systemContextLines: string[] = [];
  if (preferences?.allergies?.length) {
    systemContextLines.push(`Allergies to avoid: ${preferences.allergies.join(", ")}.`);
  }
  if (preferences?.dislikes?.length) {
    systemContextLines.push(`User dislikes: ${preferences.dislikes.join(", ")}.`);
  }
  if (preferences?.cuisine) {
    systemContextLines.push(`Preferred cuisine: ${preferences.cuisine}.`);
  }
  if (preferences?.budget) {
    systemContextLines.push(`Budget: ${preferences.budget}.`);
  }
  if (planDoc && planDoc.trim()) {
    systemContextLines.push(`Current meal plan document (editable by user):\n\n${planDoc}`);
  }

  const system = [nutritionistSystemPrompt, ...systemContextLines].join("\n\n");
  return [{ role: "system" as const, content: system }, ...userMessages];
}


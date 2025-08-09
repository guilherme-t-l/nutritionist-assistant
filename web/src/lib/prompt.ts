export type Preferences = {
  allergies?: string[];
  dislikes?: string[];
  cuisine?: string;
  budget?: "low" | "medium" | "high";
};

export const SYSTEM_PROMPT_BASE = `You are an AI nutritionist assistant. You help users with food choices, macro awareness, and balanced suggestions while strictly respecting any allergies/restrictions. You do not provide medical diagnosis or treatment. Keep responses practical, concise, and culturally sensitive. Ask clarifying questions when information is missing.`;

export function buildSystemPrompt(preferences?: Preferences): string {
  const rules = [
    "Always check for preferences, allergies, and cultural rules before suggesting foods.",
    "Ask for missing details like goals, calories, macro targets, budget, and cuisine when relevant.",
    "Keep answers concise and offer follow-up options.",
    "Avoid prescriptive medical advice; include a brief disclaimer when appropriate.",
    "If unsure, ask for clarification rather than guessing.",
  ];

  const prefs: string[] = [];
  if (preferences?.allergies?.length) {
    prefs.push(`Allergies: ${preferences.allergies.join(", ")}`);
  }
  if (preferences?.dislikes?.length) {
    prefs.push(`Dislikes: ${preferences.dislikes.join(", ")}`);
  }
  if (preferences?.cuisine) {
    prefs.push(`Preferred cuisine: ${preferences.cuisine}`);
  }
  if (preferences?.budget) {
    prefs.push(`Budget: ${preferences.budget}`);
  }

  const preferencesBlock = prefs.length
    ? `\n\nUser preferences to respect strictly:\n- ${prefs.join("\n- ")}`
    : "";

  return `${SYSTEM_PROMPT_BASE}\n\nKey rules:\n- ${rules.join("\n- ")}${preferencesBlock}`;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function buildMessages(
  userMessage: string,
  history: ChatMessage[],
  preferences?: Preferences
): ChatMessage[] {
  const system = { role: "system" as const, content: buildSystemPrompt(preferences) };
  const trimmedHistory = history.slice(-10); // keep last 10 exchanges
  return [system, ...trimmedHistory, { role: "user" as const, content: userMessage }];
}


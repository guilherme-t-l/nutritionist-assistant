## Development Plan

### Context
An AI-powered nutritionist co-pilot per `GOALS.md`. First priority: ship a conversational AI agent that talks to the user via ChatGPT (or similar), with basic memory and nutrition-safe guardrails.

### System Prompt (initial)
Role: Helpful, cautious nutritionist assistant. Not a medical provider. Stay within nutrition education, ask clarifying questions, and refuse medical diagnosis.

Key rules:
- Always check for preferences/allergies/cultural rules before suggesting foods.
- Keep answers concise; offer follow-up options.
- If unsure, ask for clarification rather than guessing.

Example preamble:
"You are an AI nutritionist assistant. You help users with food choices, macro awareness, and balanced suggestions while strictly respecting any allergies/restrictions. You do not provide medical diagnosis or treatment. Keep responses practical, concise, and culturally sensitive. Ask clarifying questions when information is missing."

### Milestones Overview
- M0: Project setup, CI, secrets, observability baseline
- M1: Conversational AI Agent (MVP) — primary focus now
- M2: Nutrition data + Macro engine (compute macros consistently)
- M3: Smart substitution engine (±5% macro tolerance)
- M4: Preferences/restrictions filtering (allergies, dislikes, rules)
- M5: Nutritionist workflow UI (plan editor, import/export)
- M6: Hardening: performance, tests, privacy/security

---

## M1 — Conversational AI Agent (MVP)

### Objective
Enable users to chat with a nutritionist assistant that:
- Responds coherently as a safe, helpful junior nutritionist
- Remembers session context (lightweight memory)
- Respects preferences/allergies when provided by user
- Can be swapped between different LLMs (Llama, ChatGPT or similar providers). 

### Target Outcome (2–5 days)
- Web chat UI with streaming responses
- Backend endpoint that proxies to LLM provider
- System prompt with role, scope, safety disclaimers
- Minimal ephemeral memory (per session) and basic analytics/logging

### User Stories
- As a user, I can type a nutrition question and get a fast answer.
- As a user, I can optionally provide preferences/allergies and the agent will respect them.
- As a nutritionist, I can review prior messages in the current session.


### Architecture (recommended)
- Frontend: Next.js (App Router) or minimal React + Vite for speed. Prefer Next.js for built-in API routes and deployment simplicity.
- Backend: Next.js API Route `/api/chat` and provider-agnostic service module.
- Memory: In-memory per session (sessionId cookie + in-process cache) plus optional localStorage mirroring client-side.
- Observability: Basic request logging; redact PII; store provider latency; feature flags.


### API Contract
- POST `/api/chat`
  - Request: `{ sessionId: string, messages: Array<{ role: 'user'|'assistant'|'system', content: string }>, preferences?: { allergies?: string[], dislikes?: string[], cuisine?: string, budget?: 'low'|'medium'|'high' } }`
  - Response: Server-Sent Events or chunked streaming with assistant messages
  - Provider switch: query param `provider=openai|anthropic|mistral` or server config

### Tasks
1) Project bootstrap
   - Create Next.js app with TypeScript, ESLint, Prettier
   - Add simple `/` page with a chat UI (input, send, stream view)
2) Provider integration
   - Add OpenAI SDK wrapper with a provider interface `LLMClient` (send, stream)
   - Read `OPENAI_API_KEY` from env; implement streaming
3) `/api/chat`
   - Validate payload; compose messages with system prompt and user context
   - Apply guardrails (e.g., block unsafe topics; add disclaimer when needed)
   - Stream tokens to client; log timings and token counts
4) Memory (session)
   - Generate `sessionId` (HTTP-only cookie)
   - Cache last N messages in memory keyed by `sessionId`
5) Analytics & logging
   - Basic server logs (duration, tokens, model)
   - Redact message content in logs by default; allow opt-in verbose debug in dev
6) UI polish
   - Show typing indicator, error state, and reconnect
   - Add a preferences panel (allergies, cuisine) stored client-side for now
7) QA & acceptance criteria
   - Manual tests for latency, context carryover, safety disclaimers
   - Add unit tests for prompt assembly and guardrails

### Acceptance Criteria
- Chat works end-to-end with streaming and <2s first-token in typical cases
- Session context is preserved across 10+ turns per session
- Agent never suggests allergens when provided; refuses risky prompts
- Simple preferences panel influences suggestions
- Provider can be swapped by config without code changes to UI

### Risks & Mitigations
- Provider latency/cost: enable smaller models by default; stream early
- Safety: guardrails + refusal patterns + lightweight content filters
- Memory privacy: store only ephemeral session memory by default

### Estimates (ballpark)
- Bootstrap & chat UI: 0.5–1 day
- Provider wrapper + streaming: 0.5–1 day
- API route + guardrails + logging: 1 day
- Session memory + preferences panel: 0.5 day
- QA, docs, small fixes: 0.5 day

---

## M2 — Nutrition Data + Macro Engine
Objective: Parse foods/ingredients and compute macros consistently.
- Choose and integrate nutrition DB (e.g., USDA FDC)
- Define canonical units; implement conversion utilities
- Implement macro calculator for items/meals/day
- Add tests against a validated dataset (<1% error)
- Create an extensive database with foods and their macros

## M3 — Smart Substitution Engine (±5% tolerance)
Objective: Suggest balanced swaps within meal/day macro bounds.
- Define candidate sets and constraints
- Scoring: macro distance, preferences, availability, cost
- Deterministic core with optional LLM ranking
- Tests for tolerance compliance and safety

## M4 — Preferences & Restrictions
Objective: Robust preference model and hard filters.
- Profile schema (allergies, dislikes, cuisine, budget)
- Enforced filtering before suggestions
- Evaluation tests to ensure zero allergen violations

## M5 — Workflow UI + Import/Export
Objective: Make nutritionists productive.
- Plan editor (create, duplicate, adjust)
- Import strict CSV/JSON template
- Export to PDF/CSV; share link
- Accept/reject suggestions; batch edits

## M6 — Hardening: Perf, Privacy, Security
Objective: Meet `GOALS.md` quality bars.
- Performance budgets (<1s single change, <5s full recalculation)
- Minimize PII; encryption in transit; env/secrets management
- Error budgets and SLOs; CI tests and lint green

---

## Immediate Next Steps (to ship M1)
1) Decide stack: Next.js + TypeScript (recommended)
2) Create project with minimal chat page and API route
3) Add OpenAI integration + streaming
4) Implement system prompt + guardrails
5) Add session memory + preferences panel
6) Smoke-test and iterate on prompt quality

## Deliverables for M1
- Running web app with chat
- `.env.example` documenting required keys
- Brief README with run instructions
- System prompt document and guardrail checklist


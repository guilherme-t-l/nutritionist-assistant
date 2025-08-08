# Project Goals

An AI-powered nutritionist co-pilot that makes creating and adjusting meal plans faster, easier, and more accurate by suggesting balanced food swaps and automatically recalculating macros. Over time, it learns each client’s preferences, restrictions, and goals.

## Vision (Why)
- Reduce the time nutritionists spend on manual adjustments and macro math.
- Preserve nutritional balance (carbs, protein, fat) when making substitutions.
- Improve client satisfaction through relevant, tasty, and culturally appropriate alternatives.
- Act as a trusted junior assistant that remembers each client and scales the nutritionist’s impact.

## Top-Level Goals
- [ ] Build a Smart Food Substitution Engine that proposes swaps within ±5% macro tolerance per meal/day.
- [ ] Implement Automated Macro Recalculation for entire plan after any change with near-instant feedback.
- [ ] Add Preference & Restriction Awareness (dislikes, allergies, cultural/religious rules, budget) to filter suggestions.
- [ ] Deliver a fast Nutritionist Workflow: create from scratch or import an existing plan; accept/reject suggestions; batch edits.
- [ ] Support Import/Export: start with a PDF/DOCS export to PDF/DOCS for client delivery.
- [ ] Ensure Privacy & Security best practices for client data.

## Success Criteria / Definition of Done
- [ ] Substitution accuracy: suggested swaps keep carbs/protein/fats within ±5% at the meal and day level.
- [ ] Performance: macro recomputation < 300ms for a single change; full 7-day plan recalculation < 1s.
- [ ] Safety: zero allergen violations in automated tests; all suggestions respect declared restrictions.
- [ ] Workflow efficiency: 5 substitutions on a 7-day plan completed in < 3 minutes by a test nutritionist.
- [ ] Quality: no critical bugs; error rate in macro calculations < 1% against a validated test set.
- [ ] Compliance/Other: stores minimal PII; data encrypted at rest and in transit.

## Metrics
- Primary: time-to-adjust-plan (mins), suggestion acceptance rate (%), weekly active nutritionists.
- Secondary: retention (D7/D30), session length, number of plans exported/shared, client satisfaction (CSAT).
- Guardrails: macro error rate < 1%; allergen/incidents = 0; compute cost per adjusted plan < $X.

## Scope
- In scope (v1):
  - Food substitution engine with macro-aware ranking.
  - Macro computation engine and plan-wide recalculation.
  - Client preference/restriction profiles and filtering.
  - Plan creation and import via CSV/JSON template; basic plan editor.
  - Export to PDF/CSV; simple share link.
  - Web app (desktop-first) with authentication.
- Out of scope (v1):
  - Medical diagnosis or prescribing protocols.
  - Native mobile apps; wearables integration.
  - Grocery delivery integrations.
  - Long-form recipe generation with cooking steps (beyond simple ingredient-level swaps).

## Stakeholders & Roles
- Owner: Guilherme
- Nutritionist advisors: <names>
- Engineering/Design: <names>
- Reviewers/Approvers: <names>

## Constraints & Assumptions
- Constraints: solo/small team; limited budget; initial launch timeline < 12 weeks.
- Assumptions: access to a reputable nutrition database (e.g., USDA FDC) and consistent units; early adopters willing to pilot.

## Risks & Mitigations
- Data accuracy of nutrition DB — Mitigation: use reputable sources; add validation tests; allow manual overrides.
- Irrelevant/unsafe AI suggestions — Mitigation: strict filters on allergies/restrictions; constrain models with rules; human-in-the-loop.
- Cultural/culinary mismatch — Mitigation: locale- and budget-aware suggestion sets; allow nutritionists to configure defaults.
- Import complexity — Mitigation: start with a strict CSV/JSON template; expand parsers iteratively.
- Privacy/security concerns — Mitigation: minimize PII; encryption; clear consent and data retention controls.

## Milestones & Timeline
- M1: Substitution + Macro Engine MVP; CSV/JSON import; basic editor.
- M2: Preferences & allergies; export to PDF/CSV; acceptance/feedback loop; analytics.
- M3: UX polish; roles/permissions; landing page + app-store style description; pilot with 3–5 nutritionists.

## Deliverables
- Working web MVP with balanced swap suggestions and instant macro recompute.
- API/SDK surface for substitutions and macro calculations.
- Import/export templates; onboarding guide.
- Landing page copy and app-store description.

## Next 1–3 Actions
- [ ] Select nutrition database and define internal food schema (units, macros, tolerances).
- [ ] Implement substitution algorithm v1 and evaluation set (macro tolerance, taste/locale tags).
- [ ] Build plan model and recomputation service; wire to basic plan editor and CSV/JSON import.

## Notes
- Future: personalized suggestions that learn from client history; seasonal/context-aware menus; cost-aware planning.
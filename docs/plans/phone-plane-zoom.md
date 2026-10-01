# Phone plane zoom — implementation plan

Adapted in `src/app/templates/onboarding.html`. On a phone-width window, a double tap, double click, or the corner icon makes that plane fill the screen. The other plane becomes a thin bar. The text does not change size. The steps below are the old pinch plan.

PRD: `docs/prds/phone-plane-zoom.md` (Draft).

## Files to change

- `src/app/templates/onboarding.html` — The split screen, both planes, and the 768px stack already live here. Meal plane is `.plan-stage` inside `.plan-panel` (kicker "Meal Plan", title "Today's menu", `#plan-save`, `#plan-card`). Chat plane is `.chat-shell` inside `.chat-panel` (title "Coach Chat", `#chat-thread`, `#chat-form` / `#chat-input` / `#chat-send`). The top bar is `.app-bar` and is not scaled. Add the zoom rules only inside the existing `@media (max-width: 768px)` block. Add the pinch script next to `showSplitView` in the same `<script>`. Do not add a file.
- `README.md` — Under "Run the server", after the preferences-slider sentence, add: "On a phone-width window (768px or narrower), the meal plan and Coach Chat are stacked. Pinch either one up to twice the size it had when that screen opened, and back down to that size. The zoom resets on reload."

## Approach

Scale is a number per plane, `meal` and `chat`, held in two `let` bindings in the page script. Both start at `1`. Do not put them on `state`, `SS_KEYS`, or `sessionStorage`. Reload runs the script again, so both are `1` again.

`1` is the size those shells already have when `#split-view` is shown at this breakpoint. The cap is `2` and the floor is `1`. A pinch multiplies the scale that was current when the second finger landed: `next = startScale * (currentDistance / startDistance)`, then clamp with `Math.min(2, Math.max(1, next))`. Spread increases it. Bringing the fingers together decreases it. Past either end, further movement does not change it.

Apply it with the CSS `zoom` property, not `transform`. On `.plan-stage` and `.chat-shell`, only inside `@media (max-width: 768px)`:

- `--plane-scale: 1` on each shell. The script sets that custom property on the shell being pinched.
- `zoom: var(--plane-scale)`.
- `width: 100%` on each shell. Do not divide width or height by the scale. `zoom` already lays the shell out in fewer CSS pixels and paints it back to the full panel width; dividing width again shrinks the visible column (about 358px to 179px at 2×) and makes the text wrap far past twice as tall. The other plane and `.app-bar` do not move.
- Cap `.chat-shell` with `height` and `max-height: calc(52vh / var(--plane-scale))`, and set `.chat-thread` `min-height: 0` in this same media query, so a scale of `2` does not double the 52vh chat box and push the message box off screen. Give `.chat-input-area` and the message field `min-width: 0` in that query so the field can shrink beside Send and both stay inside the shell. Cap `.plan-stage` with `max-height: calc(48vh / var(--plane-scale))` so the meal plane stays within the panel and `.plan-card` still scrolls.
- `touch-action: pan-y` on both shells so one finger still scrolls vertically.

`.plan-card` and `.chat-thread` already use `overflow-y: auto`. They keep scrolling the larger text. `#chat-input` stays in the last row of `.chat-shell`, so it stays on screen. Do not add zoom buttons, and do not add listeners on Save, Discard, or Send. Those buttons already sit inside the scaled shells.

Pinch listeners go on `.plan-stage` and `.chat-shell` only. `touchstart` records the two-touch distance and the current scale when `e.touches.length === 2` and `window.matchMedia("(max-width: 768px)").matches`. `touchmove` for two touches calls `preventDefault` and writes the clamped scale. One-touch moves are left alone, so scrolling and focusing `#chat-input` still work. Ignore the gesture when the window is wider than 768px.

Leaving and coming back: at the top of `showSplitView`, if `#split-view` still has `hidden`, set both scales back to `1` and reapply. That covers first open, Cancel back from the form, Back to plan from My foods, and a new plan. `showSplitView` is also called while the split is already visible (`resumeConversation` from New chat). Do not reset in that case. A full reload does not need a storage clear.

Wider than 768px: a `matchMedia("(max-width: 768px)")` `change` listener removes the inline `--plane-scale` and any inline `zoom` when the query stops matching, and applies the in-memory scales again only when it matches. The in-memory numbers survive a resize. They reset only on reload and on a hidden-to-shown `showSplitView`.

Why this approach:

- `zoom` on the existing shell, because `transform: scale` does not grow the scroll height of `.plan-card` or `.chat-thread`, so the enlarged meals and messages would clip inside `overflow: hidden`.
- Two script variables, because `sessionStorage` (`SS_KEYS`) is what survives a reload today, and this zoom must not.
- Listeners on the two shells, because a window-level listener cannot tell which plane was pinched.
- Reset only when `#split-view` was `hidden`, because New chat calls `showSplitView` without leaving the split screen.
- No gesture library, because the page has no touch code and two-touch distance is the whole gesture.

## Test command

`uv run pytest`

No new test file. Nothing in `tests/` reads this template. The suite must still pass.

## Localhost

Start: `uv run uvicorn src.app.main:app --reload`, then `http://localhost:8000/`. Use the browser's device mode so a two-finger pinch is possible. Set the width to about 390px (any width at or below 768px). If Coach Chat is on the left and the meal plan is on the right, the window is too wide.

1. Zoom the meal plan in. Continue as Guest, leave the form defaults, click Save & Build New Plan, and wait until "Today's menu" shows meals. Confirm the meal plan is stacked above the chat. On `.plan-stage` only, spread two fingers as far as the gesture goes. Do not use a button. "Today's menu" and the meal rows grow until they are about twice as tall as at open, then further spreading does not enlarge them. There is no zoom button on either plane. "Coach Chat", the thread, and the top bar (NutriAgent, New plan) stay the size they were. The meal rows still scroll inside the meal plane.
2. Zoom the meal plan back out. Same screen. Spread on the meal plane so the rows are larger, then bring two fingers together as far as the gesture goes. The rows return to the size they had when the split screen opened. Bringing the fingers closer still does not make them smaller. Coach Chat and the top bar stay at that opening size.
3. Zoom the chat in. Same screen, with the opening coach message in the thread. On `.chat-shell` only, spread two fingers as far as the gesture goes. "Coach Chat" and the message grow until they are about twice as tall as at open, then stop. "Today's menu" and the meal rows stay the size they were. The top bar stays the size it was. The message box is still on screen, accepts typing, and Send still submits. The thread still scrolls. There is no zoom button.
4. Zoom the chat back out. Same screen. Spread on the chat plane so the thread text is larger, then bring two fingers together as far as the gesture goes. The thread text returns to the opening size and does not get smaller than that. The meal plan and the top bar stay at the opening size.
5. Zoom resets after reload. Same screen. Spread on the meal plane so "Today's menu" is visibly larger, then reload `http://localhost:8000/`. The split screen is showing again. The meal plane and Coach Chat are both at the opening size, not the zoomed size. There is still no zoom button.

Also leave and come back once: pinch the meal plane, open New plan (guest reloads; a logged-in session goes to the form — use Cancel or finish and return), and confirm both planes are at the opening size again. Widen past 768px and confirm Coach Chat is on the left, the meal plan on the right, and neither plane is enlarged.

## Not building

- A zoom-in or zoom-out button, or both a button and a pinch.
- Any change to the desktop rules outside `@media (max-width: 768px)`: side-by-side columns, today's type size, no per-plane zoom.
- The viewport meta tag. Browser page zoom of the whole page stays as it is. `preventDefault` runs only for a two-finger move that started on a plane.
- Welcome, the profile form, import, and My foods. No new page or URL.
- Meal-plan text, chat replies, or how a plan is built. No Python, schema, or route edits.
- Saving the scale in `sessionStorage` or `localStorage`.
- Ctrl+wheel, double-tap, or a shared scale for both planes.
- A gesture library or any new dependency.
- A new doc besides the README note.

# Phone zoom for the chat and meal plan

Status: Draft

## Problem

On a phone, the meal plan and the coach chat share one screen, stacked. The meal plan sits on top and is short. The chat sits underneath. Their text stays the same size as on a wide screen, squeezed into a narrow column. A person holding the phone cannot enlarge just the plan to read a meal, or just the chat to read a message. The browser's own page zoom enlarges the whole page, including the other plane and the top bar.

## User

Someone on a phone-width window who already has the split screen open at `http://localhost:8000/`: the Meal Plan ("Today's menu") on top, Coach Chat below.

## Success signal

They can make the meal plan fill the screen, then bring the stacked layout back, and do the same for the chat. The text does not change size. The chosen plane grows until it is almost the whole screen, and the other plane shrinks to a thin bar. They do that with a double tap or double click on that plane, or with one tap or click on a small icon in that plane's top-right corner. The top bar stays as it is. A reload shows both planes stacked again.

## In scope

- Only when the window is 768px wide or narrower. That is the width where the app already stacks the two planes inside the split screen (`#split-view`): Meal Plan on top, Coach Chat below.
- The meal plane is the Meal Plan surface: the "Meal Plan" label, the "Today's menu" title, and the plan card under them (meals, foods, and totals once a plan is showing).
- The chat plane is the Coach Chat surface: the "Coach Chat" title, the message thread, and the message box with Send.
- Each plane can take over the screen. Two ways, and both must work:
  - Double tap, or double click, on that plane's content. Two quick taps or two quick clicks, the way a double-click works.
  - One tap or one click on a small icon in the top-right corner of that plane. The meal plane has its own icon. The chat plane has its own icon. The icon is not in the top bar.
- There is no pinch, and the text does not grow. This is the plane taking the screen, not a magnification.
- Only one plane is large at a time. Choosing the meal plan makes it fill the screen under the top bar, and leaves Coach Chat as a thin bar. Choosing the chat does the opposite. Choosing the plane that is already large returns to the stacked layout, meal plan on top and chat below.
- The icon shows a plus when that plane is not the large one, and a minus when it is.
- A double tap or double click does not fire on the zoom icon, the message box, Send, Save plan, or Discard. One tap or click on the icon still zooms. Typing, Send, Save plan, and Discard keep the behavior they have today. A double click inside the message box still selects a word there and does not zoom the chat.
- The choice does not persist. It resets when the page reloads, and when the person leaves the split screen and comes back.
- The top bar (NutriAgent, New plan, and the other header buttons) stays as it is. The other plane is still on screen, as the thin bar.
- After a zoom, the person can still scroll inside that plane, type in the message box, and use Send. Save plan and Discard, when they are on screen, still work.
- Welcome, the profile form, import, and My foods stay as they are.

## Out of scope

- Windows wider than 768px. Those keep Coach Chat on the left and the meal plan on the right, at today's size, with no per-plane zoom and no zoom icon.
- Magnifying the text. The type stays the size it has today.
- The browser's own page zoom of the whole page.
- Welcome, the profile form, import, and My foods.
- Changing the meal plan text, the chat replies, or how a plan is built.
- A new page or a new URL.

## Acceptance checks

1. Let the meal plan fill the screen with a double click
   - Open: `http://localhost:8000/` with the window about 390px wide (any width at or below 768px). Confirm the meal plan is stacked above the chat. If chat is on the left and the plan is on the right, the window is too wide. Continue as Guest, leave the form defaults, click Save & Build New Plan, and wait until "Today's menu" shows meals.
   - Do: Double-click the meal rows (two quick clicks). Do not use the icon for this check. A double tap does the same thing.
   - Expect: The meal plane fills almost the whole screen under the top bar. The meal text is the same size it was before the double-click. Coach Chat is only a thin bar along the bottom, with its title still readable. The meal icon shows a minus. The chat icon shows a plus. The top bar (NutriAgent and New plan) is unchanged. The meal rows still scroll inside the meal plane.

2. Bring the stack back with the meal icon
   - Open: The same phone-width split screen as in check 1, with the meal plane already filling the screen.
   - Do: Click or tap the icon in the top-right corner of the meal plane once.
   - Expect: The meal plan is on top and Coach Chat is below, sharing the screen as they did when the split screen opened. Both icons show a plus. The top bar is unchanged.

3. Let the chat fill the screen with its icon
   - Open: The same phone-width split screen as in check 1, with a meal plan showing and at least the opening coach message in the thread. Both planes are sharing the screen.
   - Do: Click or tap the icon in the top-right corner of the chat plane once.
   - Expect: Coach Chat fills almost the whole screen under the top bar. The message text is the same size it was. The meal plan is only a thin bar along the top of the two planes, under the app top bar, with "Today's menu" still readable. The chat icon shows a minus. The meal icon shows a plus. The message box is still on screen and still accepts typing. The thread still scrolls.

4. Bring the stack back from the chat with a double click
   - Open: The same phone-width split screen as in check 3, with the chat filling the screen.
   - Do: Double-click the coach message in the thread (not the message box, not Send, and not the icon). A double tap does the same thing.
   - Expect: The meal plan is on top and Coach Chat is below again. The chat icon shows a plus. The top bar is unchanged.

5. The message box and the plan buttons still do their own jobs
   - Open: The same phone-width split screen as in check 1, both planes sharing the screen.
   - Do: Double-click inside the message box. Then type a few letters and click Send. If Save plan and Discard are on screen, click each one once after this (Discard only if it is enabled; otherwise leave it).
   - Expect: The double-click inside the message box does not make the chat fill the screen. Send still submits. Save plan and Discard still do what they do today.

6. The full-screen plane resets after reload
   - Open: The same phone-width split screen as in check 1, with a meal plan showing.
   - Do: Click the meal plane's icon once so the meal plan fills the screen. Reload `http://localhost:8000/`.
   - Expect: The split screen is showing again, with the meal plan on top and Coach Chat below, neither one filling the screen. Both icons show a plus.

## Doc to update

`README.md`

`README.md` is the closest user-facing doc. It should say that on a phone-width window the meal plan and Coach Chat are stacked, and that a double tap, double click, or the small icon lets that plane fill the screen while the other stays a thin bar, and that this resets on reload. Do not add a new doc.

## Open questions

- None. The control is a double tap or double click, and one icon per plane. Choosing a plane makes it fill the screen. Choosing it again shows both. Memory stays "resets on reload or when you leave the split screen."

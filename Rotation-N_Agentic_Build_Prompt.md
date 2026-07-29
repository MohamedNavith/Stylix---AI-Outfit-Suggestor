# ROTATION [N] — Agentic AI Build Prompt

Paste everything below into your agentic AI coding tool (e.g. Antigravity, Claude Code, Cursor Agent). It assumes the existing app "Rotation [N]" already has: clothing catalog with photo upload, Gemini-vision-based auto-description, a 6-day routine plan screen, wash/clean flagging, and cloud sync. This prompt asks the agent to build the missing intelligence layer on top of that foundation — **no 3D modeling, no AR, no video** — using a multi-agent architecture.

---

## PROMPT TO GIVE THE AGENTIC AI

You are building the next phase of an existing mobile/web app called **Rotation [N]**, a wardrobe management app. The current app already lets a user photograph clothing items, auto-tags them with Gemini Vision (color, description, category), tracks clean/dirty status, and shows a 6-day "Routine Plan" of empty day slots with a "Wash Set & Swap" cycle. Your job is to turn this static catalog into an **agentic, self-updating outfit recommendation system**. Do not build any 3D garment modeling, AR try-on, or camera rotation/video capture features — this phase is 2D-data and reasoning only.

Build the system as a set of cooperating AI agents, each with a single clear responsibility, orchestrated by a central coordinator. Implement them as modular services/functions (not just prompt strings) so each can be tested and swapped independently.

### 1. Wardrobe Cataloging Agent (extend existing)
- Input: clothing photo(s).
- Output: structured JSON — category (top/bottom/outerwear/footwear/accessory), color(s), fabric guess, formality level (casual/smart-casual/formal), pattern, and a short style tag.
- Reuse the existing Gemini Vision integration; just standardize its output into a strict schema so downstream agents can consume it reliably.

### 2. Style Profile Agent
- Learns the user's preferences over time from: (a) explicit ratings on generated outfits (thumbs up/down), (b) which suggested outfits were actually worn vs skipped, (c) an optional short onboarding quiz (preferred colors, styles to avoid, formality bias).
- Maintains a lightweight preference vector/profile per user, updated after every feedback event.
- Output: a preference profile object that biases future outfit scoring.

### 3. Context Agent
- Pulls two signals for the upcoming week: weather forecast (temperature, rain/wind) for the user's location, and calendar events (if the user connects one) to detect occasion type (gym, work, formal event, casual day).
- If no calendar is connected, fall back to a simple day-type default (weekday = casual/work, weekend = casual).
- Output: a per-day context object (date, weather summary, occasion type).

### 4. Outfit Generation Agent
- Core matching engine. For each day in the cycle, selects a compatible top + bottom (+ outerwear/footwear when relevant) from **only the items currently marked CLEAN**.
- Combination rules: color coordination (complementary/neutral pairing), formality match to the day's occasion, weather appropriateness (e.g. no shorts flagged for a cold/rainy day), and **no repeat of the same combination within the current rotation cycle**.
- Must weight choices using the Style Profile Agent's preference vector.
- Output: one outfit per day for the week, each item tagged with its wardrobe ID.

### 5. Feedback & Learning Agent
- After a day passes (or the user manually confirms what they wore), record: was the suggested outfit worn as-is, swapped, or skipped, and any explicit rating.
- Feed this back into the Style Profile Agent to adjust future scoring — this is the loop that stops the app from repeating outfits the user visibly dislikes.

### 6. Laundry & Rotation Agent (extend existing)
- Already exists as "Wash Set & Swap." Extend it so that once the Outfit Generation Agent assigns an item to a day, it is automatically flagged for wash after that day, and excluded from the following cycle's candidate pool until marked clean again.

### 7. Coordinator Agent
- Orchestrates the above agents in sequence each time a new week/cycle starts: Context → (Style Profile lookup) → Outfit Generation → present to user → Feedback capture → Laundry flagging.
- Exposes one clean function/API the UI layer calls (e.g. `generateWeeklyPlan(userId)`) so the mobile app, website, and laptop client all hit the same backend logic.

### Technical constraints
- Backend: Python (FastAPI) or Node (Express) — pick whichever integrates most easily with the existing Gemini API calls already in the app.
- Data storage: keep using the existing cloud sync/database approach already in the app (encrypted at rest, as already implemented).
- Frontend: keep parity across mobile app, website, and desktop by using a single cross-platform frontend (Flutter or React/React Native + React web) calling the same backend API — do not fork logic per platform.
- No 3D modeling libraries, no AR frameworks, no video capture pipelines. All reasoning is on structured JSON + Gemini Vision descriptions, not on live video.
- Keep every agent as an independently callable, testable function/module — do not hardcode agent logic inline in UI code.

### Deliverables expected from you (the agentic AI)
1. Updated data schema for wardrobe items (adding formality, pattern, style tag fields).
2. The six agent modules described above, each with clear input/output contracts.
3. The Coordinator function that runs the weekly cycle end-to-end.
4. UI updates to the existing Routine Plan screen so it displays the generated outfit per day instead of "Empty Day," with a thumbs up/down feedback control.
5. A short test script that simulates one full week's cycle with sample wardrobe data.

Build iteratively: cataloging schema first, then outfit generation with hardcoded context, then wire in real weather/calendar, then add the feedback loop last.

# Rotation [N]

**An agentic AI wardrobe assistant that catalogs your clothes, plans your week's outfits, and manages your laundry rotation — so you never repeat a combination unnecessarily and never wonder what to wear.**

## What it does

Rotation [N] photographs and catalogs your wardrobe (using Gemini Vision to auto-describe each item), then uses a small team of cooperating AI agents to:

1. Understand your personal style and preferences over time.
2. Check the week's weather and your calendar for context.
3. Generate a full week of outfit combinations from only your currently-clean clothes.
4. Track what you actually wore, learn from your feedback, and flag worn items for washing.
5. Rotate the clean/dirty cycle automatically so suggestions never repeat within a cycle.

No manual outfit planning. No digging through drawers wondering what's clean. No repeating the same shirt three days running by accident.

## Who this is useful for

- **Busy professionals and students** who want to save the daily decision-making time of picking an outfit.
- **People with limited wardrobes or laundry access** (e.g. students in shared housing, people in small apartments) who need to track what's actually clean before planning outfits.
- **People building a capsule wardrobe** who want to maximize combinations from a small number of items without repetition.
- **Fashion retailers and personal styling services**, as a white-label recommendation engine to help customers plan purchases around what pairs well with what they own.
- **Anyone who's ever laid out three outfits before 8am and been late because of it.**

## Core architecture

Rotation [N] is built as a multi-agent system rather than one large model call:

| Agent | Responsibility |
|---|---|
| Wardrobe Cataloging Agent | Photo → structured item data (category, color, formality, style) |
| Style Profile Agent | Learns preferences from feedback over time |
| Context Agent | Pulls weather + calendar to set the day's occasion |
| Outfit Generation Agent | Matches clean items into weekly outfit combinations |
| Feedback & Learning Agent | Records what was worn/skipped and updates preferences |
| Laundry & Rotation Agent | Flags worn items dirty, rotates the clean pool |
| Coordinator Agent | Runs the whole weekly cycle end-to-end |

This phase deliberately excludes 3D garment modeling and AR try-on — the focus is on getting the recommendation and rotation logic right first. 3D/AR virtual try-on is a natural phase-two extension once the core agent loop is solid.

## Project scope (4-week build)

- **Week 1:** Wardrobe data schema + cataloging agent refinement.
- **Week 2:** Style Profile Agent + basic preference learning.
- **Week 3:** Context Agent (weather/calendar) + Outfit Generation Agent.
- **Week 4:** Feedback loop, UI wiring into the existing Routine Plan screen, and polish across mobile/web/desktop.

## Business angle

As a business analytics project, Rotation [N] demonstrates a personalization and recommendation engine with a clear feedback loop — the same pattern used in retail recommendation systems — applied to a genuine daily-life problem (decision fatigue and laundry management), with a plausible path to real commercial use (styling services, capsule-wardrobe apps, retail cross-sell).

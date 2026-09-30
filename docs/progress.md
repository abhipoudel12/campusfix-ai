# CampusFix AI progress and submission evidence

## 2026-09-24 — Initial scope

- Goal: ship an original, publicly reachable AWS application before the hackathon deadline.
- Demo: photo + optional location/description → suggested triage report → saved dashboard entry.
- Proposed services: Amplify Hosting, Lambda Function URL, S3, DynamoDB, Bedrock Nova Lite. These choices remain subject to actual account availability, regional support, Free Plan/credit coverage, and endpoint security review.
- Scope exclusions until the MVP works: authentication, maps, notifications, assignment workflow, training a model, analytics.
- Category/lane proposal: workplace efficiency/community.
- Cost requirement: zero out of pocket; verify Free Plan and credits, set billing alerts, test with small images, and address public invocation abuse before deploying inference.

## Evidence to collect as we build

- Coding agent connected to the AWS console: connection method, date, screenshot, and what the agent did. No proof captured yet.
- AWS services and region used, resource names, configuration decisions, and costs/credit checks.
- Feature milestones and Git commits, screenshots, tests and results.
- Public app URL and a fresh unauthenticated test before submission.
- Builder Center project URL, two tags, demo narrative, and final submission status.

## Test log

| Date | Milestone | Result |
| --- | --- | --- |
| 2026-09-24 | Initial local Git repository | Pending verification |

## 2026-09-30 — Milestone 1: local frontend demo

- Built a responsive, accessible Vite/vanilla JavaScript frontend with CampusFix AI branding, photo validation and preview, location and notes, and explicit sample scenario selection.
- Added sample report generation, an in-memory dashboard, counts, status changes, score sorting, and status filtering.
- Demo scoring rule: Low/Medium/High = 25/50/70, hazard +15, recurring issue +5, capped at 100. This is a triage aid, not a validated safety assessment.
- The uploaded photo is not analyzed or stored; example report facts come from the selected scenario. Reports clear on refresh. No AWS calls, resources, or deployment were made for this milestone.
- Checks: `npm test` passed (3 tests); `npm run build` passed; local Vite server returned HTTP 200. Browser automation was unavailable in this session, so responsive layout and interaction need manual browser verification.
- Next milestone: real backend and Bedrock integration, with AWS cost/Free Plan checks before any AWS action that could consume credits or incur charges.

| Date | Milestone | Result |
| --- | --- | --- |
| 2026-09-30 | Frontend tests, build, server smoke check | Passed: 3 tests, Vite build, HTTP 200 |
| 2026-09-30 | Browser interaction and responsive review | Not run: browser automation surface unavailable |

## 2026-09-30 — Frontend theme and interaction refinement

- Redesigned the local frontend with a compact navigation, near-black surfaces, cyan/violet gradients, ambient glow, fine panel borders, and responsive report composer and dashboard. Navigation links only to implemented page sections.
- Replaced decorative star branding with an original inline SVG campus building and check mark. The header mark has a one-second cyan/violet shadow glow; the mark itself stays steady, and the glow stops with reduced-motion settings.
- Added restrained section entrances, upload and preview feedback, a short **Preparing demo report** state that blocks duplicate submissions, animated score values and meters, an expandable score breakdown, status badges and confirmation, and filter/sort feedback. The breakdown uses the same severity, hazard, and recurring points as the scoring function.
- Demo limits remain visible: uploaded photos are previewed locally but are not analyzed or uploaded; report facts come from a selected sample scenario; reports live only in memory and are not sent to a facilities team. The score is a demo triage aid, not a validated safety assessment. No AWS services were used or deployed.
- Checks performed: `npm test` passed (4 tests); `npm run build` passed; `node --check src/main.js` passed; `git diff --check` passed. Browser automation was unavailable, so desktop/mobile visual verification remains manual.

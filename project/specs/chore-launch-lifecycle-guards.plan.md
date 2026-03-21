# Implementation Plan for chore-launch-lifecycle-guards
- **Status**: Implemented

## Overview
Implement explicit launch lifecycle transition guards for Launch Status values `scheduled`, `active`, `completed`, and `cancelled`, without changing API surface or persistence structure. Validation will be enforced in service-layer update flow so booking eligibility remains derived from valid launch state.

## Step 1: Define lifecycle transition rules in launch domain
- [x] Add a lifecycle transition map in `src/services/launch.service.ts` (or a nearby launch-domain helper) for allowed transitions:
  - `scheduled -> active | cancelled`
  - `active -> completed | cancelled`
  - `completed ->` (none, terminal)
  - `cancelled ->` (none, terminal)
- [x] Keep create behavior aligned with current design: default initial status to `scheduled` when not provided.
- [x] Ensure only known launch status values are accepted by update validation paths.

## Step 2: Enforce guards in launch update business logic
- [x] Extend `LaunchService.update` in `src/services/launch.service.ts` to validate requested `status` transitions against current persisted status before repository update.
- [x] Reject invalid transitions with `ValidationError` and field-level detail for `status`.
- [x] Preserve non-status launch updates when `status` is absent.
- [x] Keep repository and store layers unchanged except for data passed after validation.

## Step 3: Keep route behavior and error responses consistent
- [x] Verify `src/routes/launchRoutes.ts` continues to rely on `handleError` so invalid transitions return existing validation error JSON shape.
- [x] Confirm no route contract changes are required for `PUT /api/launches/:id`.
- [x] Confirm booking guard in `src/services/booking.service.ts` remains unchanged (`launch.status === active`).

## Step 4: Add unit tests for lifecycle transitions
- [x] Create `src/services/launch.service.spec.ts` focused on lifecycle guard behavior.
- [x] Add positive transition tests:
  - `scheduled -> active`
  - `scheduled -> cancelled`
  - `active -> completed`
  - `active -> cancelled`
- [x] Add negative transition tests:
  - `scheduled -> completed`
  - `active -> scheduled`
  - any transition from `completed`
  - any transition from `cancelled`
- [x] Add a test confirming updates without `status` still succeed for mutable non-status fields.

## Step 5: Add API acceptance tests for lifecycle guards
- [x] Add a Playwright test file (implemented as `tests/launchLifecycle.spec.ts`) for lifecycle guard acceptance behavior.
- [x] Cover accepted transitions via `PUT /api/launches/:id` with HTTP 200.
- [x] Cover rejected transitions with HTTP 400 and validation error payload.
- [x] Add terminal-state checks proving no further transitions from `completed` or `cancelled`.
- [x] Add a booking integration assertion showing non-active launch booking is rejected (can reuse existing booking scenario patterns).

## Step 6: Regression checks and completion criteria
- [x] Run targeted unit tests: launch service and booking service suites.
- [x] Run targeted E2E lifecycle and booking availability scenarios.
- [ ] Run full verification command set for project confidence (`npm run test:unit` and `npm test`).
- [x] Ensure acceptance criteria in `project/specs/chore-launch-lifecycle-guards.spec.md` are fully mapped to tests before coding handoff.

## Definition of Done
- [x] Invalid lifecycle transitions are rejected before persistence.
- [x] Completed and cancelled are enforced as terminal states.
- [x] Booking behavior remains constrained to active launches.
- [x] Unit and E2E tests cover both allowed and rejected transitions.
- [x] No changes to storage model or public route paths are introduced.
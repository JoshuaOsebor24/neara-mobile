# TODO: Revert Search Overlay Changes

## Approved Plan Execution

**Goal:** Rollback app/(tabs)/search.tsx to pre-Blackbox state - no search overlay, no map-behind-search, standard full-screen search screen.

**Steps:**

1. [x] Create TODO-REVERT-SEARCH-OVERLAY.md ✅ (this file)
2. [x] Edit `app/(tabs)/search.tsx`:
   - Remove overlay/preview modes & logic
   - Simplify to idle/search states
   - Standard back navigation
   - Unified results + map below input ✅ Completed
3. [x] Post-revert cleanup completed:
   - Removed leftover `as any` usage in `app/(tabs)/search.tsx`
   - Fixed the unescaped apostrophe lint issue in the idle subtitle
   - Confirmed the search screen keeps the full-screen revert behavior
4. [ ] Manual test revert:
   - Home → search: full-screen, no overlay/map-under-search
   - Query: results + map below (not behind)
   - Back/close: standard navigation
5. [ ] Confirm store page search unchanged
6. [ ] Final cleanup & attempt_completion

**Note:** Earlier notes that implied the revert had already been fully validated were stale. The screen needed follow-up fixes before the current state was accurate again.

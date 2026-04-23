---
id: optimistic-updates
domain: frontend
category: ui-ux
depends_on:
  - loading-error-empty-states
  - unidirectional-data-flow
related:
  - local-component-state
  - global-application-state
  - form-state-machines
anti_pattern_of: null
severity: recommended
---

# Optimistic Updates

## Definition
An optimistic update immediately reflects a user action in the UI — before the server confirms the change — by assuming the operation will succeed, then rolling back if it fails.

## Why It Matters
Without optimistic updates, every user action that requires a server round-trip has a perceived delay: click "like," wait 200-2000ms, see the like count increment. Click "delete," see a spinner, wait, see the item disappear. This latency makes the application feel sluggish and unresponsive. With optimistic updates, the UI responds instantly to user actions, creating the perception of a fast, native-like application. The like count increments immediately. The deleted item vanishes instantly. If the server rejects the action, the UI rolls back. For operations with a high success rate (99%+), the user almost never sees a rollback.

## Why It Matters
The perceived responsiveness difference between 0ms and 200ms is enormous. Users can feel latency above ~100ms, and anything above 300ms feels "slow." Network latency is unavoidable, but the user doesn't need to wait for it. Optimistic updates trade occasional rollback complexity for consistently fast-feeling interactions.

## The Anti-Pattern
The developer disables the UI element (button, toggle, etc.) during the server round-trip, shows a spinner, and only updates the UI on success. Every interaction has a visible pause. For frequently-used actions (favoriting, liking, toggling, reordering), this pause accumulates into a frustrating experience. The developer may not know that optimistic updates are an option — they treat every action as a synchronous request-response cycle that must complete before the UI can change.

```
// Pessimistic: wait for server before updating UI
async function handleLike(postId) {
  setLikeLoading(true);        // Show spinner on the like button
  try {
    await api.likePost(postId);  // Wait 200-2000ms
    setLiked(true);              // NOW update the UI
    setLikeCount(prev => prev + 1);
  } catch (e) {
    showError('Could not like post');
  }
  setLikeLoading(false);
}

// Optimistic: update UI immediately, rollback on failure
async function handleLike(postId) {
  // Capture previous state for rollback
  const prevLiked = liked;
  const prevCount = likeCount;

  // Update UI immediately
  setLiked(true);
  setLikeCount(prev => prev + 1);

  try {
    await api.likePost(postId);  // Server confirms in background
  } catch (e) {
    // Rollback to previous state
    setLiked(prevLiked);
    setLikeCount(prevCount);
    showError('Could not like post. Please try again.');
  }
}
```

## Recognition Signal
Click a toggle, like button, or delete button in the application. If there's a visible delay before the UI changes, the update is pessimistic. If the button enters a "loading" state for routine operations, the update is pessimistic. Optimistic updates are appropriate when: the operation has a high success rate, the rollback experience is acceptable (a brief flicker back to the previous state), and the operation doesn't have irreversible consequences that require explicit confirmation.

## Related Concepts
**Loading, error, and empty states** provides the fallback: even with optimistic updates, error handling is still needed for the rollback case. **Unidirectional data flow** applies to the rollback mechanism — the UI must be able to revert to a previous state cleanly, which is easier when state flows in one direction. **Local component state** or **global application state** is where the optimistic change and its rollback are tracked. **Form state machines** is the analogous pattern for form submissions — the "submitting" state can optimistically show "success" before server confirmation.

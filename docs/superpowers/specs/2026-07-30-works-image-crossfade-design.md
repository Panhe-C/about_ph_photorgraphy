# Works Image Crossfade Design

## Goal

Add a true, blank-free crossfade when the visitor moves between photographs on
the Works page. Preserve the current navigation, description plates, captions,
layout, and accessibility behavior.

## Interaction

- Keep the current photograph fully visible while the next photograph loads.
- Decode the requested photograph before starting the transition.
- Crossfade the outgoing and incoming photographs together over 220 ms.
- Update the caption when the incoming photograph begins to appear.
- If several navigation requests arrive during a transition, settle on the most
  recently requested photograph without flashing an older request.
- Keep description-plate transitions and series navigation behavior unchanged.
- When `prefers-reduced-motion: reduce` is active, switch photographs without an
  animated crossfade.

## Implementation

Use two stacked image elements inside the existing plate stage. One is the
visible layer and the other is the loading/incoming layer. Both use the existing
image sizing constraints and occupy the same visual stage.

The page script owns a small transition controller:

1. Record the latest requested series and photo.
2. Load and decode that photograph in the inactive image layer.
3. If the request is still current, apply the target metadata and start the
   opacity transition: incoming `0 → 1`, outgoing `1 → 0`.
4. After the transition, swap the active/inactive roles and clear transient
   styles and listeners.
5. If another request arrived meanwhile, immediately process that latest
   request.

The controller must not remove the outgoing image before the incoming image is
ready. Failed image loads leave the current photograph visible.

## Scope Boundaries

- Do not redesign the Works page or change its navigation model.
- Do not change image discovery, optimization, captions, or source data.
- Do not add an animation library.
- Do not animate description text or unrelated controls as part of this change.

## Verification

- Add a focused automated test for the crossfade controller's request ordering,
  ready-before-fade behavior, and reduced-motion path.
- Run the existing Node test suite and Astro build.
- In the live browser, verify next/previous clicks, arrow-key navigation, rapid
  repeated input, different image aspect ratios, description-to-photo movement,
  and reduced-motion behavior.

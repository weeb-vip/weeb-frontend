---
timestamp: 2026-09-01T02-43-33Z
slug: src-svelte-components-profileimageupload-svelte
---
# Critique — ProfileImageUpload.svelte (avatar + banner cropper)
Method: dual-agent · Mode: Operate · Design Health 25/40

## Heuristics
1 Visibility 2 · 2 Match-real-world 2 (zoom inverted) · 3 User-control 3 · 4 Consistency 2 · 5 Error-prevention 3 (avatar min 0×0 dead) · 6 Recognition 3 · 7 Flexibility 2 · 8 Aesthetic 2 (slider out-shouts CTA) · 9 Error-recovery 3 · 10 Help 3. Total 25/40.

## Detector
Clean — 0 findings, exit 0. All defects are visual/design, not mechanical.

## Priority issues
1. Zoom slider breaks the Cursor Rule (24px accent-filled pill + 32px white-ring thumb out-shouts the accent Upload CTA) and looks generic; thumb overhangs the track end.
2. Zoom is inverted (right = bigger box = more image = zoomed OUT) and has no numeric readout — the exact place a mono numeral belongs.
3. Interior is a stock upload modal (generic cloud glyph, "Tap to upload", white dashed crop box); no dragover active state; no bespoke framing tied to the art-forward world.
4. Peak-end: on success the modal just vanishes — no confirmation at the highest-stakes moment (Button already supports a success status).
5. Copy + enforcement diverge between variants; avatar min is 0×0 so a tiny avatar upscales to a blurry 800×800 while an equivalent banner is rejected.

## Visual defects (from screenshots)
- Avatar circle touches top/bottom of preview (cramped); banner crop has letterbox margin — inconsistent framing between the two modes.
- Crop box is a thin dashed rect with no drag handles despite "Drag the box" copy — weak affordance for the primary interaction.
- Header close X sits lower than the title baseline (both variants).
- Action alignment split: "Choose Different Image" centered vs "Cancel/Upload" right — no single rule.
- Low-contrast "Zoom" label + helper line; footer separator differs between the two modals.

## Strengths
- Real shared abstraction (one crop math, variant presets) — not a copy-paste twin.
- Live darkened-mask crop feedback reads correctly (circular avatar included).
- Defensive error handling + a11y bones (specific dimension errors, role=alert, focus trap, Escape).

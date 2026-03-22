# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [1.1.0] — 2026-03-22

### Added

- **New node: Load Image To Canvas** — loads an image from disk and composites it onto a user-defined canvas with full interactive control
  - Live preview canvas embedded in the node, updates reactively on every parameter change
  - Drag to reposition image on the preview
  - Velocity-sensitive scroll to zoom (rapid scroll = coarser steps, deliberate = finer); Shift+scroll for large jumps
  - Shift+drag to draw an aspect-ratio-locked crop box on the preview — releases zoom and reposition to fill the canvas with the selected region
  - Rotary dial widgets for zoom X and Y with diagonal drag input, scroll nudge, and click-to-edit numeric readout
  - **Aspect ratio lock** toggle button (🔒 Aspect Ratio Locked / 🔓 Aspect Ratio Unlocked) in the zoom area — locking preserves the x:y ratio established while unlocked
  - **Fit Width / Fit Height snap buttons** flanking the dial(s) — quick-action buttons that scale the image to fill the chosen canvas axis (respects lock state: locked = uniform scale + centre both offsets; unlocked = scale that axis only + centre that offset)
  - **= (Equalize) button** between the Width and Height dials in unlocked mode — copies Width zoom to Height, restoring the image's natural undistorted aspect ratio
  - **⇄ Swap W↔H button** at the top of the preview — swaps `canvas_width` and `canvas_height` values; fires widget callbacks so displayed values update and the node resizes immediately
  - **Resolution label** just below the preview canvas — shows `W × H` canvas dimensions; updates on every redraw
  - Flip horizontal / flip vertical controls
  - Same 6 padding fill options as the rest of the pack (black, white, gray_50, transparent, custom, noise)
  - Custom colour picker with optional `custom_color_hex_input` connector
  - Context-aware mask output: canvas-space (white = image, black = padding) when padding is present; source-image-space (white = sampled pixels) when fully covered
  - `invert_mask` toggle
  - Original image passthrough output (no transforms applied)

### Fixed

- **Load Image To Canvas — preview rendering**
  - Black preview bug: `ch` (canvas height) was accidentally dropped when the scaling-mode pipeline was removed, causing a silent JS error that prevented image drawing
  - Preview canvas now fills the full node width dynamically — it reads the wrapper's rendered width on every draw and redraws when the user resizes the node, maintaining the correct aspect ratio at any node size

- **Load Image To Canvas — UI**
  - Aspect ratio lock is now a styled toggle button beside the zoom dials rather than a plain ComfyUI boolean field
  - Zoom dials now lay out correctly side by side in unlocked mode; `computeSize` heights are accurate so dials no longer overlap widgets below them
  - Suppressed ComfyUI's built-in duplicate image preview that appeared at the bottom of the node when `image_upload: true` is set
  - DOM widget wrappers now use `pointer-events: none` with `pointer-events: auto` on interactive children, so standard widgets (offsets, flips, mask invert) below DOM overlays correctly receive clicks
  - "Choose file to upload" button now appears at the top of the node (index 1, directly below the image picker) rather than at the bottom

- **All nodes — copy-paste ghost elements**
  - `onConnectionsChange`, `onConfigure`, and `onResize` hooks were being set on `nodeType.prototype` from inside `onNodeCreated`, meaning each new instance overwrote the prototype closure and broke all prior instances. Moved all three hooks to instance level (`node.onX = …`) across all three extensions so every node has its own isolated closure

- **Load Image To Canvas — ghost overlays on workflow load / node removal**
  - ComfyUI does not reliably remove DOM widget elements from the canvas overlay when a node is deleted or a workflow is reloaded, leaving orphaned ghost elements that are visible but completely non-interactive. Added `node.onRemoved` (instance-level) to explicitly call `.remove()` on every DOM widget element owned by the node

- **Load Image To Canvas — standard widgets below zoom area not clickable**
  - `lockedView` and `unlockedView` divs had `pointer-events:auto` on the whole container, so any overflow beyond their declared `computeSize` height silently blocked clicks on `offset_y`, `flip_horizontal`, `flip_vertical`, and `invert_mask`. Changed both view containers to `pointer-events:none`; only the specific interactive children (lock buttons, dial wrappers) now have `pointer-events:auto`

- **Load Image To Canvas — copy-paste and workflow-load produce broken node (canvas_width → NaN, dial stuck at top of screen)**
  - **Root cause (two-part):** (1) LiteGraph's `serialize()` writes `widgets_values` with **sparse** indices (null holes at every `serialize===false` widget), but `configure()` reads them back with a **dense** counter — so every non-serialisable widget shifts all subsequent values one slot. (2) The previous fix (sparse re-apply loop in `onConfigure`) failed because the image-upload button is added by ComfyUI *after* `onNodeCreated` and moved to index 1 by a `requestAnimationFrame` that fires *after* `configure()`. So during `onConfigure` the button is still at the **end** of the widget list, not at index 1 where it sat when the node was serialised. The sparse loop therefore reads `widgets_values[1]` (the button's null hole) into `canvas_width` (which is at index 1 in the clone) → NaN.
  - **Fix:** At the start of `onConfigure`, before the sparse re-apply loop, find the upload button and move it to index 1. This aligns the clone's widget indices with the serialised indices so the loop applies the correct value to every widget.

- **Load Image To Canvas — preview drag-to-reposition broken after swap button introduction**
  - The swap button was initially added as a separate `addDOMWidget` element inserted before `previewDomW` in the widget list. Its DOM overlay interfered with the preview canvas's `pointerdown`/`pointermove` capture, breaking drag-to-reposition. Also, the swap handler only set `.value` directly without firing the widget callbacks, so the displayed `canvas_width`/`canvas_height` values did not update.
  - **Fix:** Moved the swap button inside `buildPreviewCanvas` as part of the preview wrapper DOM (no separate DOM widget), and updated the click handler to call `wW.callback?.(wW.value)` / `wH.callback?.(wH.value)` so the wrapped callbacks fire, values display correctly, and the node resizes properly.

---

## [1.0.1] — 2025-05-03

### Added

- Node icon (`assets/icon-resizetocanvas.svg`) registered in `pyproject.toml`

### Changed

- README updated to reflect pack structure and node descriptions

---

## [1.0.0] — 2025-05-03

Initial release.

### Added

- **Resize To Canvas Size** node — resize an image to an exact canvas size with a 3×3 anchor grid, 5 scale methods, 2 fill methods, and 6 padding fill options; outputs RGBA image + padding mask
- **Resize To Canvas Size (COI)** node — mask-driven Centre of Interest placement using a 7×7 target grid; supports `manual`, `mask_bbox_centre`, and `mask_weighted_centre` anchor modes
- Custom anchor grid widget (3×3 HTML button grid with Photoshop-style arrow indicators)
- Custom COI grid widget (7×7 canvas dot lattice drawn over a 3×3 nonant background)
- Color picker DOM widget replacing the plain string hex input for `custom_color_hex`
- Optional `custom_color_hex_input` connector that overrides the picker when connected
- `noise_seed` field shown only when `padding_fill` is `noise`
- `pyproject.toml`, `LICENSE` (MIT), and GitHub Actions publish workflow
- Example workflow JSON (`examples/ResizeToCanvasSize_Example_Workflow.json`)

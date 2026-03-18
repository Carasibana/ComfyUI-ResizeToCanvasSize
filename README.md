# ComfyUI-ResizeToCanvasSize

A ComfyUI custom node that resizes an image to an exact target canvas size with full control over how scaling and cropping/stretching are handled.

---

## Features

- **Photoshop-style anchor grid** — 3×3 button grid at the top of the node; click any cell to set the anchor point. The selected cell shows a dot, directly adjacent cells show arrows pointing away from the anchor, and non-adjacent cells are blank
- **5 scale methods** — choose how the image is scaled before the final fit step
- **2 fill methods** — crop (trim overflow, optionally pad gaps) or stretch (distort to fill)
- **6 padding fill options** — black, white, 50% gray, transparent, custom colour (native colour picker), or random noise with a seed
- **Outputs RGBA image + padding mask** — the `padding_mask` output is `1` where padding was added and `0` where original image pixels are, making it easy to pipe into an inpainting workflow

---

## Inputs

| Input | Type | Description |
|---|---|---|
| `image` | IMAGE | Source image (batch supported) |
| `width` | INT | Target canvas width in pixels |
| `height` | INT | Target canvas height in pixels |
| `anchor` | Anchor Grid | 3×3 click grid — sets the anchor point for crop/pad positioning |
| `scale_method` | Dropdown | How to scale the image before filling (see below) |
| `fill_method` | Dropdown | `crop` or `stretch` |
| `padding_fill` | Dropdown | How to fill any gaps (see below) |
| `custom_color_hex` | Colour picker | Only shown when `padding_fill` is `custom` |
| `custom_color_hex_input` | STRING (optional connector) | Only visible when `padding_fill` is `custom`. Connect any node that outputs a `#RRGGBB` / `#RRGGBBAA` string to override the colour picker. Invalid values fall back to the picker value. |
| `noise_seed` | INT | Seed for noise generation — only shown when `padding_fill` is `noise` |

---

## Scale Methods

| Method | Behaviour |
|---|---|
| `None – use original size` | No scaling — use the image at its original resolution |
| `Fit to Canvas short edge` | Scale so the image's shortest edge matches the canvas's shortest edge |
| `Fit to Canvas long edge` | Scale so the image's longest edge matches the canvas's longest edge |
| `Fit to Canvas height` | Scale to match the canvas height exactly |
| `Fit to Canvas width` | Scale to match the canvas width exactly |

After scaling, the image may be larger than the canvas (overflow → crop) or smaller (gap → filled with `padding_fill`).

---

## Padding Fill Options

| Option | Behaviour |
|---|---|
| `black` | Fill gaps with solid black |
| `white` | Fill gaps with solid white |
| `gray_50` | Fill gaps with 50% gray |
| `transparent` | Fill gaps with transparency (alpha = 0) |
| `custom` | Fill gaps with a colour chosen via the colour picker |
| `noise` | Fill gaps with random per-pixel noise — a `noise_seed` field appears to control reproducibility |

---

## Fill Methods

| Method | Behaviour |
|---|---|
| `crop` | Place the scaled image using the anchor position, trim any overflow, fill any gaps with the padding colour. Anchor determines which part of the image is kept. |
| `stretch` | Distort/resize the scaled image to exactly fill the canvas. Anchor is not used. |

---

## Outputs

| Output | Type | Description |
|---|---|---|
| `IMAGE` | IMAGE (RGBA) | The resized image |
| `padding_mask` | MASK | `1.0` where padding was added, `0.0` where original image pixels are. All zeros when no padding occurred. |

---

## Common Recipes

**Crop to square, keep the centre:**
- `scale_method`: `Fit to Canvas short edge` · `fill_method`: `crop` · `anchor`: center

**Letterbox / pillarbox (fit within canvas, pad the rest):**
- `scale_method`: `Fit to Canvas long edge` · `fill_method`: `crop` · `padding_fill`: black

**Distort to fill (ignore aspect ratio):**
- `scale_method`: `None – use original size` · `fill_method`: `stretch`

**Cookie-cutter crop at original resolution:**
- `scale_method`: `None – use original size` · `fill_method`: `crop` — canvas dimensions act as a crop window at the anchor position

**Inpaint the padded region:**
- Connect `padding_mask` to a KSampler inpainting setup to fill padding areas with generated content

---

## Installation

Clone this repository into your ComfyUI `custom_nodes` folder:

```bash
cd ComfyUI/custom_nodes
git clone http://mcnabnas.local:3000/Carasibana/ComfyUI-ResizeToCanvasSize.git
```

Then restart ComfyUI.

No additional Python packages are required beyond those already included with ComfyUI (Pillow, NumPy, PyTorch).

---

## File Structure

```
ComfyUI-ResizeToCanvasSize/
├── __init__.py          # Registers the node and web directory
├── nodes.py             # Python node logic
└── js/
    └── anchor_widget.js # Custom anchor grid UI widget
```

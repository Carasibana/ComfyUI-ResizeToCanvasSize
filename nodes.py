import torch
import numpy as np
from PIL import Image


ANCHOR_OPTIONS = [
    "top_left",    "top_center",    "top_right",
    "middle_left", "center",        "middle_right",
    "bottom_left", "bottom_center", "bottom_right",
]

ANCHOR_MAP = {
    "top_left":      ("left",   "top"),
    "top_center":    ("center", "top"),
    "top_right":     ("right",  "top"),
    "middle_left":   ("left",   "middle"),
    "center":        ("center", "middle"),
    "middle_right":  ("right",  "middle"),
    "bottom_left":   ("left",   "bottom"),
    "bottom_center": ("center", "bottom"),
    "bottom_right":  ("right",  "bottom"),
}


class ResizeToCanvasSize:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image":        ("IMAGE",),
                "width":        ("INT",  {"default": 512, "min": 1, "max": 8192, "step": 1}),
                "height":       ("INT",  {"default": 512, "min": 1, "max": 8192, "step": 1}),
                "anchor":       (ANCHOR_OPTIONS, {"default": "center"}),
                "scale_method": ([
                                     "None – use original size",
                                     "Fit to Canvas short edge",
                                     "Fit to Canvas long edge",
                                     "Fit to Canvas height",
                                     "Fit to Canvas width",
                                 ], {"default": "Fit to Canvas short edge"}),
                "fill_method":  (["crop", "stretch"], {"default": "crop"}),
                "padding_fill": (["black", "white", "gray_50", "transparent", "custom", "noise"],
                                 {"default": "black"}),
                "custom_color_hex": ("STRING", {"default": "#000000"}),
                "noise_seed":   ("INT",    {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "optional": {
                # Connected value overrides the colour picker; must be #RRGGBB or #RRGGBBAA.
                # Invalid values fall back to the picker value.
                "custom_color_hex_input": ("STRING", {"forceInput": True}),
            },
        }

    RETURN_TYPES  = ("IMAGE", "MASK")
    RETURN_NAMES  = ("IMAGE", "padding_mask")
    FUNCTION      = "resize"
    CATEGORY      = "image/transform"
    OUTPUT_NODE   = False

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def resize(self, image, width, height, anchor, scale_method, fill_method,
               padding_fill, custom_color_hex, noise_seed, custom_color_hex_input=None):
        """Process every image in the batch."""
        # If a node is connected to custom_color_hex_input, validate and use it;
        # fall back to the picker value on any invalid input.
        if custom_color_hex_input is not None:
            resolved_color = self._sanitize_hex(custom_color_hex_input, custom_color_hex)
        else:
            resolved_color = custom_color_hex

        results, masks = [], []

        for i in range(image.shape[0]):
            img_t, mask_t = self._process_single(
                image[i], width, height, anchor,
                scale_method, fill_method,
                padding_fill, resolved_color, noise_seed,
            )
            results.append(img_t)
            masks.append(mask_t)

        return (torch.stack(results), torch.stack(masks))

    # ------------------------------------------------------------------
    # Core per-image logic
    # ------------------------------------------------------------------

    def _process_single(self, img_tensor, tgt_w, tgt_h, anchor,
                        scale_method, fill_method,
                        padding_fill, custom_color_hex, noise_seed):
        pil = self._tensor_to_pil(img_tensor)
        src_w, src_h = pil.size

        # --- Step 1: scale ---
        scale = self._compute_scale(src_w, src_h, tgt_w, tgt_h, scale_method)
        new_w = max(1, round(src_w * scale))
        new_h = max(1, round(src_h * scale))

        scaled = pil.resize((new_w, new_h), Image.LANCZOS) if (new_w, new_h) != (src_w, src_h) else pil
        sc_w, sc_h = scaled.size

        # --- Step 2: fill ---
        if fill_method == "stretch":
            result = scaled.resize((tgt_w, tgt_h), Image.LANCZOS)
            return (
                self._pil_to_tensor(result),
                torch.zeros(tgt_h, tgt_w, dtype=torch.float32),
            )

        # fill_method == "crop"
        return self._crop_fill(
            scaled, sc_w, sc_h, tgt_w, tgt_h,
            anchor, padding_fill, custom_color_hex, noise_seed,
        )

    def _crop_fill(self, scaled, sc_w, sc_h, tgt_w, tgt_h,
                   anchor, padding_fill, custom_color_hex, noise_seed):
        paste_x, paste_y = self._anchor_offset(anchor, sc_w, sc_h, tgt_w, tgt_h)

        if padding_fill == "noise":
            rng = np.random.default_rng(noise_seed)
            noise_arr = rng.integers(0, 256, (tgt_h, tgt_w, 4), dtype=np.uint8)
            noise_arr[:, :, 3] = 255
            canvas = Image.fromarray(noise_arr, "RGBA")
        else:
            pad_rgba = self._parse_color(padding_fill, custom_color_hex)
            canvas   = Image.new("RGBA", (tgt_w, tgt_h), pad_rgba)

        pad_mask = np.ones((tgt_h, tgt_w), dtype=np.float32)  # 1 = padding

        # Overlap region between scaled image and canvas
        src_x1 = max(0, -paste_x)
        src_y1 = max(0, -paste_y)
        src_x2 = min(sc_w, tgt_w - paste_x)
        src_y2 = min(sc_h, tgt_h - paste_y)

        dst_x1 = max(0, paste_x)
        dst_y1 = max(0, paste_y)
        dst_x2 = dst_x1 + (src_x2 - src_x1)
        dst_y2 = dst_y1 + (src_y2 - src_y1)

        if src_x2 > src_x1 and src_y2 > src_y1:
            region = scaled.crop((src_x1, src_y1, src_x2, src_y2))
            canvas.paste(region, (dst_x1, dst_y1))
            pad_mask[dst_y1:dst_y2, dst_x1:dst_x2] = 0.0  # 0 = original image

        return (
            self._pil_to_tensor(canvas),
            torch.from_numpy(pad_mask),
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_scale(src_w, src_h, tgt_w, tgt_h, method):
        if method == "None – use original size":   return 1.0
        if method == "Fit to Canvas short edge":   return min(tgt_w, tgt_h) / min(src_w, src_h)
        if method == "Fit to Canvas long edge":    return max(tgt_w, tgt_h) / max(src_w, src_h)
        if method == "Fit to Canvas height":       return tgt_h / src_h
        if method == "Fit to Canvas width":        return tgt_w / src_w
        return 1.0

    @staticmethod
    def _anchor_offset(anchor, src_w, src_h, tgt_w, tgt_h):
        """Return (paste_x, paste_y): where the top-left of src lands on canvas.
        Negative values mean the image overflows on that side (gets cropped)."""
        h_key, v_key = ANCHOR_MAP[anchor]
        x = {"left": 0, "center": (tgt_w - src_w) // 2, "right": tgt_w - src_w}[h_key]
        y = {"top":  0, "middle": (tgt_h - src_h) // 2, "bottom": tgt_h - src_h}[v_key]
        return x, y

    @staticmethod
    def _sanitize_hex(value, fallback="#000000"):
        """Validate a hex colour string; return value if valid, fallback otherwise."""
        try:
            h = str(value).strip().lstrip("#").strip()
            if len(h) in (6, 8) and all(c in "0123456789abcdefABCDEF" for c in h):
                return "#" + h
        except (AttributeError, TypeError):
            pass
        return fallback

    @staticmethod
    def _parse_color(padding_fill, custom_color_hex):
        """Return (R, G, B, A) 0-255."""
        presets = {
            "black":       (0,   0,   0,   255),
            "white":       (255, 255, 255, 255),
            "gray_50":     (128, 128, 128, 255),
            "transparent": (0,   0,   0,   0),
        }
        if padding_fill in presets:
            return presets[padding_fill]

        # custom_color_hex has already been sanitized and resolved upstream.
        try:
            h = str(custom_color_hex).strip().lstrip("#").strip()
            if len(h) == 6:
                r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
                return (r, g, b, 255)
            if len(h) == 8:
                r, g, b, a = (int(h[i:i+2], 16) for i in (0, 2, 4, 6))
                return (r, g, b, a)
        except (ValueError, AttributeError, TypeError):
            pass
        return (0, 0, 0, 255)

    @staticmethod
    def _tensor_to_pil(tensor):
        """[H, W, C] float32 0-1 → PIL RGBA."""
        np_img = (tensor.cpu().numpy() * 255).clip(0, 255).astype(np.uint8)
        if np_img.shape[2] == 3:
            return Image.fromarray(np_img, "RGB").convert("RGBA")
        return Image.fromarray(np_img, "RGBA")

    @staticmethod
    def _pil_to_tensor(pil_img):
        """PIL RGBA → [H, W, 4] float32 0-1."""
        return torch.from_numpy(np.array(pil_img.convert("RGBA"))).float() / 255.0


def _coi_bbox(mask_np):
    """Bounding box centre of non-zero mask pixels. mask_np: H×W float32 [0,1]."""
    rows = np.any(mask_np > 0, axis=1)
    cols = np.any(mask_np > 0, axis=0)
    if not rows.any():
        return mask_np.shape[1] / 2.0, mask_np.shape[0] / 2.0
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    return (cmin + cmax) / 2.0, (rmin + rmax) / 2.0


def _coi_weighted(mask_np):
    """Weighted centroid (centre of mass). mask_np: H×W float32 [0,1]."""
    total = mask_np.sum()
    if total == 0:
        return mask_np.shape[1] / 2.0, mask_np.shape[0] / 2.0
    h, w = mask_np.shape
    cx = (mask_np * np.arange(w)[np.newaxis, :]).sum() / total
    cy = (mask_np * np.arange(h)[:, np.newaxis]).sum() / total
    return cx, cy


ANCHOR_MODE_OPTIONS = ["manual", "mask_bbox_centre", "mask_weighted_centre"]


class ResizeToCanvasSizeMask(ResizeToCanvasSize):
    """
    Resize to canvas with mask-driven Centre of Interest (COI) placement.

    A 7×7 target grid (overlaid on a 3×3 nonant visual) selects where the COI
    lands on the canvas.  In all modes the grid means "place the COI here":

      manual               – COI = image centre (src_w/2, src_h/2)
      mask_bbox_centre     – COI = centre of bounding box of non-zero mask pixels
      mask_weighted_centre – COI = weighted centroid (centre of mass) of mask values

    Grid coordinates (col, row) in range 0–6 map to canvas fractions col/6, row/6
    so the 49 selectable points span every nonant boundary, midpoint, and centre.
    Default (3,3) places the COI at canvas centre.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image":        ("IMAGE",),
                "width":        ("INT",  {"default": 512, "min": 1, "max": 8192, "step": 1}),
                "height":       ("INT",  {"default": 512, "min": 1, "max": 8192, "step": 1}),
                "anchor_grid":  ("STRING", {"default": "3,3"}),
                "anchor_mode":  (ANCHOR_MODE_OPTIONS, {"default": "manual"}),
                "scale_method": ([
                                     "None – use original size",
                                     "Fit to Canvas short edge",
                                     "Fit to Canvas long edge",
                                     "Fit to Canvas height",
                                     "Fit to Canvas width",
                                 ], {"default": "Fit to Canvas short edge"}),
                "fill_method":  (["crop", "stretch"], {"default": "crop"}),
                "padding_fill": (["black", "white", "gray_50", "transparent", "custom", "noise"],
                                 {"default": "black"}),
                "custom_color_hex": ("STRING", {"default": "#000000"}),
                "noise_seed":   ("INT",    {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "optional": {
                "mask": ("MASK",),
                "custom_color_hex_input": ("STRING", {"forceInput": True}),
            },
        }

    RETURN_TYPES  = ("IMAGE", "MASK")
    RETURN_NAMES  = ("IMAGE", "padding_mask")
    FUNCTION      = "resize"
    CATEGORY      = "image/transform"
    OUTPUT_NODE   = False

    def resize(self, image, width, height, anchor_grid, anchor_mode,
               scale_method, fill_method, padding_fill, custom_color_hex,
               noise_seed, mask=None, custom_color_hex_input=None):
        if custom_color_hex_input is not None:
            resolved_color = self._sanitize_hex(custom_color_hex_input, custom_color_hex)
        else:
            resolved_color = custom_color_hex

        try:
            col, row = (max(0, min(6, int(v))) for v in anchor_grid.split(","))
        except (ValueError, AttributeError):
            col, row = 3, 3

        results, masks = [], []
        batch = image.shape[0]

        for i in range(batch):
            mask_i = None
            if mask is not None:
                mi = min(i, mask.shape[0] - 1)
                mask_i = mask[mi]   # [H, W]

            img_t, mask_t = self._process_single_coi(
                image[i], width, height, col, row, anchor_mode,
                scale_method, fill_method,
                padding_fill, resolved_color, noise_seed,
                mask_i,
            )
            results.append(img_t)
            masks.append(mask_t)

        return (torch.stack(results), torch.stack(masks))

    def _process_single_coi(self, img_tensor, tgt_w, tgt_h, col, row, anchor_mode,
                             scale_method, fill_method, padding_fill, custom_color_hex,
                             noise_seed, mask_tensor=None):
        pil = self._tensor_to_pil(img_tensor)
        src_w, src_h = pil.size

        scale = self._compute_scale(src_w, src_h, tgt_w, tgt_h, scale_method)
        new_w = max(1, round(src_w * scale))
        new_h = max(1, round(src_h * scale))
        scaled = pil.resize((new_w, new_h), Image.LANCZOS) if (new_w, new_h) != (src_w, src_h) else pil
        sc_w, sc_h = scaled.size

        if fill_method == "stretch":
            result = scaled.resize((tgt_w, tgt_h), Image.LANCZOS)
            return (
                self._pil_to_tensor(result),
                torch.zeros(tgt_h, tgt_w, dtype=torch.float32),
            )

        # Compute Centre of Interest in source-image pixel space
        if anchor_mode != "manual" and mask_tensor is not None:
            mask_np = mask_tensor.cpu().numpy().astype(np.float32)
            if mask_np.shape != (src_h, src_w):
                m_pil = Image.fromarray((mask_np * 255).clip(0, 255).astype(np.uint8), "L")
                m_pil = m_pil.resize((src_w, src_h), Image.NEAREST)
                mask_np = np.array(m_pil).astype(np.float32) / 255.0
            if anchor_mode == "mask_bbox_centre":
                coi_x, coi_y = _coi_bbox(mask_np)
            else:
                coi_x, coi_y = _coi_weighted(mask_np)
        else:
            coi_x, coi_y = src_w / 2.0, src_h / 2.0

        # Scale COI to the resized image space, then compute paste position
        canvas_x = col * tgt_w / 6.0
        canvas_y = row * tgt_h / 6.0
        paste_x  = int(round(canvas_x - coi_x * scale))
        paste_y  = int(round(canvas_y - coi_y * scale))

        return self._crop_fill_at(
            scaled, sc_w, sc_h, tgt_w, tgt_h,
            paste_x, paste_y, padding_fill, custom_color_hex, noise_seed,
        )

    def _crop_fill_at(self, scaled, sc_w, sc_h, tgt_w, tgt_h,
                      paste_x, paste_y, padding_fill, custom_color_hex, noise_seed):
        if padding_fill == "noise":
            rng = np.random.default_rng(noise_seed)
            noise_arr = rng.integers(0, 256, (tgt_h, tgt_w, 4), dtype=np.uint8)
            noise_arr[:, :, 3] = 255
            canvas = Image.fromarray(noise_arr, "RGBA")
        else:
            pad_rgba = self._parse_color(padding_fill, custom_color_hex)
            canvas   = Image.new("RGBA", (tgt_w, tgt_h), pad_rgba)

        pad_mask = np.ones((tgt_h, tgt_w), dtype=np.float32)

        src_x1 = max(0, -paste_x)
        src_y1 = max(0, -paste_y)
        src_x2 = min(sc_w, tgt_w - paste_x)
        src_y2 = min(sc_h, tgt_h - paste_y)

        dst_x1 = max(0, paste_x)
        dst_y1 = max(0, paste_y)
        dst_x2 = dst_x1 + (src_x2 - src_x1)
        dst_y2 = dst_y1 + (src_y2 - src_y1)

        if src_x2 > src_x1 and src_y2 > src_y1:
            region = scaled.crop((src_x1, src_y1, src_x2, src_y2))
            canvas.paste(region, (dst_x1, dst_y1))
            pad_mask[dst_y1:dst_y2, dst_x1:dst_x2] = 0.0

        return (
            self._pil_to_tensor(canvas),
            torch.from_numpy(pad_mask),
        )


NODE_CLASS_MAPPINGS        = {
    "ResizeToCanvasSize":     ResizeToCanvasSize,
    "ResizeToCanvasSizeMask": ResizeToCanvasSizeMask,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ResizeToCanvasSize":     "Resize To Canvas Size",
    "ResizeToCanvasSizeMask": "Resize To Canvas Size (COI)",
}

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
                "custom_color": ("STRING", {"default": "#000000"}),
                "noise_seed":   ("INT",    {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            }
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
               padding_fill, custom_color, noise_seed):
        """Process every image in the batch."""
        results, masks = [], []

        for i in range(image.shape[0]):
            img_t, mask_t = self._process_single(
                image[i], width, height, anchor,
                scale_method, fill_method,
                padding_fill, custom_color, noise_seed,
            )
            results.append(img_t)
            masks.append(mask_t)

        return (torch.stack(results), torch.stack(masks))

    # ------------------------------------------------------------------
    # Core per-image logic
    # ------------------------------------------------------------------

    def _process_single(self, img_tensor, tgt_w, tgt_h, anchor,
                        scale_method, fill_method,
                        padding_fill, custom_color, noise_seed):
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
            anchor, padding_fill, custom_color, noise_seed,
        )

    def _crop_fill(self, scaled, sc_w, sc_h, tgt_w, tgt_h,
                   anchor, padding_fill, custom_color, noise_seed):
        paste_x, paste_y = self._anchor_offset(anchor, sc_w, sc_h, tgt_w, tgt_h)

        if padding_fill == "noise":
            rng = np.random.default_rng(noise_seed)
            noise_arr = rng.integers(0, 256, (tgt_h, tgt_w, 4), dtype=np.uint8)
            noise_arr[:, :, 3] = 255
            canvas = Image.fromarray(noise_arr, "RGBA")
        else:
            pad_rgba = self._parse_color(padding_fill, custom_color)
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
    def _parse_color(padding_fill, custom_color):
        """Return (R, G, B, A) 0-255."""
        presets = {
            "black":       (0,   0,   0,   255),
            "white":       (255, 255, 255, 255),
            "gray_50":     (128, 128, 128, 255),
            "transparent": (0,   0,   0,   0),
        }
        if padding_fill in presets:
            return presets[padding_fill]

        # custom hex (#RRGGBB or #RRGGBBAA)
        h = custom_color.lstrip("#")
        try:
            if len(h) == 6:
                r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
                return (r, g, b, 255)
            if len(h) == 8:
                r, g, b, a = (int(h[i:i+2], 16) for i in (0, 2, 4, 6))
                return (r, g, b, a)
        except ValueError:
            pass
        return (0, 0, 0, 255)  # fallback

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


NODE_CLASS_MAPPINGS        = {"ResizeToCanvasSize": ResizeToCanvasSize}
NODE_DISPLAY_NAME_MAPPINGS = {"ResizeToCanvasSize": "Resize To Canvas Size"}

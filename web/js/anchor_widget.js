import { app } from "../../scripts/app.js";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const CELL     = 24;   // grid cell size (px)
const LABEL_H  = 16;   // "anchor" label height above grid
const PAD      = 4;
const WIDGET_H = LABEL_H + PAD + CELL * 3 + PAD;

// Anchor values in row-major order (matches nodes.py ANCHOR_OPTIONS)
const POSITIONS = [
    "top_left",    "top_center",    "top_right",
    "middle_left", "center",        "middle_right",
    "bottom_left", "bottom_center", "bottom_right",
];

// Arrow pointing FROM (fromRow, fromCol) TOWARD (toRow, toCol)
function arrowToward(fromRow, fromCol, toRow, toCol) {
    const dr = toRow - fromRow;
    const dc = toCol - fromCol;
    if (dr === 0 && dc === 0) return "●";
    if (dr > 0  && dc === 0) return "↓";
    if (dr < 0  && dc === 0) return "↑";
    if (dr === 0 && dc > 0)  return "→";
    if (dr === 0 && dc < 0)  return "←";
    if (dr > 0  && dc > 0)   return "↘";
    if (dr > 0  && dc < 0)   return "↙";
    if (dr < 0  && dc > 0)   return "↗";
    return "↖";
}

// Build a standalone anchor-grid widget object
function makeAnchorGridWidget(name, value) {
    return {
        type:    "ANCHOR_GRID",
        name,
        value:   POSITIONS.includes(value) ? value : "center",

        // Cached during draw; used in mouse handler
        _gridX: 0,
        _gridY: 0,

        draw(ctx, node, width, y) {
            const selIdx = POSITIONS.indexOf(this.value);
            const selRow = Math.floor(selIdx / 3);
            const selCol = selIdx % 3;

            const gridW = CELL * 3;
            const gridX = Math.floor((width - gridW) / 2);
            const gridY = y + LABEL_H + PAD;

            this._gridX = gridX;
            this._gridY = gridY;

            ctx.save();

            // Label
            ctx.font         = "11px sans-serif";
            ctx.fillStyle    = LiteGraph?.WIDGET_TEXT_COLOR ?? "#aaa";
            ctx.textAlign    = "left";
            ctx.textBaseline = "top";
            ctx.fillText(name, PAD, y + 2);

            // Grid
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    const cx         = gridX + col * CELL;
                    const cy         = gridY + row * CELL;
                    const isSelected = row === selRow && col === selCol;

                    // Background
                    ctx.fillStyle = isSelected ? "#555" : "#222";
                    ctx.fillRect(cx, cy, CELL - 1, CELL - 1);

                    // Border
                    ctx.strokeStyle = "#666";
                    ctx.lineWidth   = 0.5;
                    ctx.strokeRect(cx + 0.5, cy + 0.5, CELL - 2, CELL - 2);

                    // Symbol
                    const sym = arrowToward(row, col, selRow, selCol);
                    ctx.fillStyle    = isSelected ? "#fff" : "#999";
                    ctx.font         = `${Math.floor(CELL * 0.58)}px sans-serif`;
                    ctx.textAlign    = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(sym, cx + CELL / 2, cy + CELL / 2);
                }
            }

            ctx.restore();
        },

        mouse(event, pos, node) {
            if (event.type !== "pointerdown") return false;

            const relX = pos[0] - this._gridX;
            const relY = pos[1] - this._gridY;

            if (relX < 0 || relY < 0 || relX >= CELL * 3 || relY >= CELL * 3) {
                return false;
            }

            const col = Math.floor(relX / CELL);
            const row = Math.floor(relY / CELL);

            if (row >= 0 && row < 3 && col >= 0 && col < 3) {
                this.value = POSITIONS[row * 3 + col];
                node.setDirtyCanvas(true, true);
                return true;
            }
            return false;
        },

        computeSize(width) {
            return [width, WIDGET_H];
        },
    };
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------
app.registerExtension({
    name: "ResizeToCanvasSize.AnchorWidget",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "ResizeToCanvasSize") return;

        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.call(this);

            // --- Replace the "anchor" COMBO with the graphical grid ---
            const anchorIdx = this.widgets?.findIndex(w => w.name === "anchor");
            if (anchorIdx == null || anchorIdx < 0) return;

            const currentValue = this.widgets[anchorIdx].value ?? "center";
            this.widgets.splice(anchorIdx, 1); // remove combo

            const gridWidget = makeAnchorGridWidget("anchor", currentValue);
            this.widgets.splice(anchorIdx, 0, gridWidget); // insert at same slot

            // --- Show/hide custom_color based on padding_color ---
            const paddingColorW = this.widgets.find(w => w.name === "padding_color");
            const customColorW  = this.widgets.find(w => w.name === "custom_color");

            if (paddingColorW && customColorW) {
                const sync = () => {
                    const isCustom       = paddingColorW.value === "custom";
                    customColorW.hidden  = !isCustom;
                    customColorW.computeSize = isCustom ? undefined : () => [0, -4];
                    this.setSize(this.computeSize());
                    this.setDirtyCanvas(true);
                };

                const origCb = paddingColorW.callback;
                paddingColorW.callback = (...args) => {
                    origCb?.call(paddingColorW, ...args);
                    sync();
                };

                sync();
            }

            this.setSize(this.computeSize());
        };
    },
});

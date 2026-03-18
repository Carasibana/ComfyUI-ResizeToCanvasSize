import { app } from "../../scripts/app.js";

const CELL = 24;
const PAD  = 4;
const GRID  = CELL * 3;        // 72 px
const CANVAS_W = GRID + PAD * 2;
const CANVAS_H = GRID + PAD * 2;

const POSITIONS = [
    "top_left",    "top_center",    "top_right",
    "middle_left", "center",        "middle_right",
    "bottom_left", "bottom_center", "bottom_right",
];

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

function renderGrid(canvas, value) {
    const ctx    = canvas.getContext("2d");
    const selIdx = POSITIONS.indexOf(value);
    const selRow = selIdx < 0 ? 1 : Math.floor(selIdx / 3);
    const selCol = selIdx < 0 ? 1 : selIdx % 3;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const cx  = PAD + col * CELL;
            const cy  = PAD + row * CELL;
            const sel = row === selRow && col === selCol;

            ctx.fillStyle = sel ? "#555" : "#222";
            ctx.fillRect(cx, cy, CELL - 2, CELL - 2);

            ctx.strokeStyle = "#666";
            ctx.lineWidth   = 0.5;
            ctx.strokeRect(cx + 0.5, cy + 0.5, CELL - 3, CELL - 3);

            const sym = arrowToward(row, col, selRow, selCol);
            ctx.fillStyle    = sel ? "#fff" : "#999";
            ctx.font         = `${Math.floor(CELL * 0.6)}px sans-serif`;
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(sym, cx + (CELL - 2) / 2, cy + (CELL - 2) / 2);
        }
    }
}

app.registerExtension({
    name: "ResizeToCanvasSize.AnchorWidget",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "ResizeToCanvasSize") return;

        // ── onNodeCreated ────────────────────────────────────────────────────
        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);

            const node = this;

            // 1. Find the hidden STRING widget that carries the value to Python
            const anchorW = node.widgets?.find(w => w.name === "anchor");
            if (!anchorW) return;

            // Hide it — zero height so it takes no space
            anchorW.computeSize = () => [0, -4];
            if (anchorW.inputEl) anchorW.inputEl.style.display = "none";

            // 2. Build the canvas DOM element
            const canvas = document.createElement("canvas");
            canvas.width  = CANVAS_W;
            canvas.height = CANVAS_H;
            canvas.style.display = "block";
            canvas.style.cursor  = "pointer";

            node._anchorCanvas = canvas;
            renderGrid(canvas, anchorW.value || "center");

            // 3. Click → update hidden widget + redraw
            canvas.addEventListener("pointerdown", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = canvas.getBoundingClientRect();
                const x    = e.clientX - rect.left - PAD;
                const y    = e.clientY - rect.top  - PAD;
                const col  = Math.floor(x / CELL);
                const row  = Math.floor(y / CELL);
                if (row >= 0 && row < 3 && col >= 0 && col < 3) {
                    anchorW.value = POSITIONS[row * 3 + col];
                    renderGrid(canvas, anchorW.value);
                }
            });

            // 4. Add as DOM widget (serialize:false — anchorW carries the value)
            const domW = node.addDOMWidget("anchor_grid", "ANCHOR_GRID", canvas, {
                serialize: false,
            });
            domW.computeSize = () => [CANVAS_W, CANVAS_H + 4];

            // 5. Show/hide custom_color based on padding_color
            const paddingColorW = node.widgets?.find(w => w.name === "padding_color");
            const customColorW  = node.widgets?.find(w => w.name === "custom_color");

            if (paddingColorW && customColorW) {
                const sync = () => {
                    const show = paddingColorW.value === "custom";
                    customColorW.hidden     = !show;
                    customColorW.computeSize = show ? undefined : () => [0, -4];
                    if (customColorW.inputEl) {
                        customColorW.inputEl.style.display = show ? "" : "none";
                    }
                    node.setSize(node.computeSize());
                    node.setDirtyCanvas(true);
                };
                const origCb = paddingColorW.callback;
                paddingColorW.callback = (...args) => {
                    origCb?.apply(paddingColorW, args);
                    sync();
                };
                sync();
            }

            node.setSize(node.computeSize());
        };

        // ── onConfigure — re-render grid after workflow load ─────────────────
        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (o) {
            origOnConfigure?.apply(this, arguments);
            const anchorW = this.widgets?.find(w => w.name === "anchor");
            if (anchorW && this._anchorCanvas) {
                renderGrid(this._anchorCanvas, anchorW.value || "center");
            }
        };
    },
});

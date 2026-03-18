import { app } from "../../scripts/app.js";

const POSITIONS = [
    "top_left",    "top_center",    "top_right",
    "middle_left", "center",        "middle_right",
    "bottom_left", "bottom_center", "bottom_right",
];

// Arrow pointing AWAY from the selected anchor.
// Returns "" for cells that are not directly adjacent (more than 1 step away).
function getArrow(fromRow, fromCol, selRow, selCol) {
    if (fromRow === selRow && fromCol === selCol) return "●";
    if (Math.abs(fromRow - selRow) > 1 || Math.abs(fromCol - selCol) > 1) return "";
    const dr = fromRow - selRow;
    const dc = fromCol - selCol;
    if (dr < 0 && dc < 0) return "↖";
    if (dr < 0 && dc === 0) return "↑";
    if (dr < 0 && dc > 0) return "↗";
    if (dr === 0 && dc < 0) return "←";
    if (dr === 0 && dc > 0) return "→";
    if (dr > 0 && dc < 0) return "↙";
    if (dr > 0 && dc === 0) return "↓";
    return "↘";
}

function buildAnchorGrid(anchorW) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:6px 0 8px;width:100%;box-sizing:border-box;gap:4px;";

    // Small label
    const label = document.createElement("div");
    label.textContent = "Anchor";
    label.style.cssText = "font-size:11px;color:#aaa;letter-spacing:1px;text-transform:uppercase;";
    wrapper.appendChild(label);

    // 3×3 CSS grid
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(3,36px);grid-template-rows:repeat(3,36px);gap:2px;";

    const buttons = [];

    function refresh() {
        const selIdx = POSITIONS.indexOf(anchorW.value || "center");
        const selRow = Math.floor(selIdx / 3);
        const selCol = selIdx % 3;
        buttons.forEach((btn, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const sel = i === selIdx;
            btn.textContent = getArrow(row, col, selRow, selCol);
            btn.style.background = sel ? "#606060" : "#2a2a2a";
            btn.style.color      = sel ? "#ffffff" : "#aaaaaa";
        });
    }

    for (let i = 0; i < 9; i++) {
        const btn = document.createElement("button");
        btn.style.cssText = [
            "width:36px", "height:36px",
            "border:1px solid #555",
            "border-radius:3px",
            "font-size:18px",
            "line-height:1",
            "cursor:pointer",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "padding:0",
            "box-sizing:border-box",
        ].join(";");

        btn.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            anchorW.value = POSITIONS[i];
            refresh();
        });

        buttons.push(btn);
        grid.appendChild(btn);
    }

    wrapper.appendChild(grid);
    refresh();

    return { wrapper, refresh };
}

app.registerExtension({
    name: "ResizeToCanvasSize.AnchorWidget",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "ResizeToCanvasSize") return;

        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);

            const node = this;

            // Hide the backing STRING widget (still serialises the value to Python)
            const anchorW = node.widgets?.find(w => w.name === "anchor");
            if (!anchorW) return;
            anchorW.computeSize = () => [0, -4];

            // Build the 9-button grid
            const { wrapper, refresh } = buildAnchorGrid(anchorW);
            node._anchorRefresh = refresh;

            const domW = node.addDOMWidget("anchor_grid", "ANCHOR_GRID", wrapper, {
                serialize: false,
            });
            domW.computeSize = () => [3 * 36 + 2 * 2, 3 * 36 + 2 * 2 + 30]; // grid + label

            // Move the DOM widget to sit right after the hidden anchor STRING widget,
            // so it appears above scale_method / fill_method etc.
            // (Same technique as ComfyUI-SimpleFloatSlider)
            const anchorIdx = node.widgets.findIndex(w => w.name === "anchor");
            const domIdx    = node.widgets.indexOf(domW);
            if (anchorIdx >= 0 && domIdx > anchorIdx + 1) {
                node.widgets.splice(domIdx, 1);
                node.widgets.splice(anchorIdx + 1, 0, domW);
            }

            // Show / hide custom_color field
            const paddingColorW = node.widgets?.find(w => w.name === "padding_color");
            const customColorW  = node.widgets?.find(w => w.name === "custom_color");
            if (paddingColorW && customColorW) {
                const sync = () => {
                    const show = paddingColorW.value === "custom";
                    customColorW.hidden = !show;
                    customColorW.computeSize = show ? undefined : () => [0, -4];
                    if (customColorW.inputEl) customColorW.inputEl.style.display = show ? "" : "none";
                    node.setSize(node.computeSize());
                    node.setDirtyCanvas(true);
                };
                const origCb = paddingColorW.callback;
                paddingColorW.callback = (...args) => { origCb?.apply(paddingColorW, args); sync(); };
                sync();
            }

            node.setSize(node.computeSize());
        };

        // Re-render after a saved workflow is loaded
        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (o) {
            origOnConfigure?.apply(this, arguments);
            if (this._anchorRefresh) this._anchorRefresh();
        };
    },
});

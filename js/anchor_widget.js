import { app } from "../../scripts/app.js";

const POSITIONS = [
    "top_left",    "top_center",    "top_right",
    "middle_left", "center",        "middle_right",
    "bottom_left", "bottom_center", "bottom_right",
];

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

function buildAnchorGrid(getVal, setVal) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:6px 0 8px;width:100%;box-sizing:border-box;gap:4px;";

    const label = document.createElement("div");
    label.textContent = "Anchor";
    label.style.cssText = "font-size:11px;color:#aaa;letter-spacing:1px;text-transform:uppercase;";
    wrapper.appendChild(label);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(3,36px);grid-template-rows:repeat(3,36px);gap:2px;";

    const buttons = [];

    function refresh() {
        const selIdx = POSITIONS.indexOf(getVal() || "center");
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
            setVal(POSITIONS[i]);
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

            // Remove the anchor COMBO widget — the DOM widget below owns the value entirely
            const anchorIdx = node.widgets?.findIndex(w => w.name === "anchor") ?? -1;
            const initVal   = anchorIdx >= 0 ? (node.widgets[anchorIdx].value || "center") : "center";
            if (anchorIdx >= 0) node.widgets.splice(anchorIdx, 1);

            node._anchorValue = initVal;

            // Build the 9-button grid
            const { wrapper, refresh } = buildAnchorGrid(
                ()  => node._anchorValue,
                (v) => { node._anchorValue = v; },
            );
            node._anchorRefresh = refresh;

            // Add DOM widget. getValue/setValue let ComfyUI serialise/deserialise
            // automatically — no hidden backing widget, no manual onSerialize needed.
            const domW = node.addDOMWidget("anchor", "ANCHOR_GRID", wrapper, {
                getValue: () => node._anchorValue,
                setValue: (v) => { node._anchorValue = v; refresh(); },
            });
            domW.computeSize = () => [3 * 36 + 2 * 2, 3 * 36 + 2 * 2 + 30];

            // Slot the DOM widget into the position the COMBO occupied so Python's
            // widgets_values index mapping stays correct.
            const domIdx = node.widgets.indexOf(domW);
            const target = anchorIdx >= 0 ? anchorIdx : Math.min(2, node.widgets.length - 1);
            if (domIdx !== target) {
                node.widgets.splice(domIdx, 1);
                node.widgets.splice(target, 0, domW);
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
    },
});

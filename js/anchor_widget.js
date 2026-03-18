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

function buildColorPicker(getVal, setVal) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 12px;width:100%;box-sizing:border-box;height:32px;";

    const label = document.createElement("span");
    label.textContent = "Custom color";
    label.style.cssText = "font-size:12px;color:#ccc;flex:1;";

    const input = document.createElement("input");
    input.type = "color";
    input.value = getVal() || "#000000";
    input.style.cssText = "width:48px;height:24px;padding:0;border:1px solid #555;border-radius:3px;cursor:pointer;";
    input.addEventListener("input", () => setVal(input.value));

    wrapper.appendChild(label);
    wrapper.appendChild(input);

    return { wrapper, input };
}

// Resize the node: grow to fit computed size but never shrink below prevW/prevH.
function resizeNode(node, prevW, prevH) {
    const [cw, ch] = node.computeSize();
    node.setSize([Math.max(prevW, cw), Math.max(prevH, ch)]);
}

// Show or hide a standard (non-DOM) widget.
function setWidgetVisible(w, visible) {
    if (!w) return;
    w.hidden = !visible;
    w.computeSize = visible ? undefined : () => [0, -4];
    if (w.inputEl) w.inputEl.style.display = visible ? "" : "none";
}

app.registerExtension({
    name: "ResizeToCanvasSize.AnchorWidget",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "ResizeToCanvasSize") return;

        const origOnCreated = nodeType.prototype.onNodeCreated;

        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);

            const node = this;

            // ── Anchor grid ───────────────────────────────────────────────────
            const anchorIdx  = node.widgets?.findIndex(w => w.name === "anchor") ?? -1;
            const initAnchor = anchorIdx >= 0 ? (node.widgets[anchorIdx].value || "center") : "center";
            if (anchorIdx >= 0) node.widgets.splice(anchorIdx, 1);
            node._anchorValue = initAnchor;

            const { wrapper: anchorWrapper, refresh: anchorRefresh } = buildAnchorGrid(
                ()  => node._anchorValue,
                (v) => { node._anchorValue = v; },
            );
            node._anchorRefresh = anchorRefresh;

            const anchorDomW = node.addDOMWidget("anchor", "ANCHOR_GRID", anchorWrapper, {
                getValue: () => node._anchorValue,
                setValue: (v) => { node._anchorValue = v; anchorRefresh(); },
            });
            anchorDomW.computeSize = () => [3 * 36 + 4, 3 * 36 + 4 + 30];

            // Slot into the position the COMBO occupied.
            const anchorDomIdx = node.widgets.indexOf(anchorDomW);
            const anchorTarget = anchorIdx >= 0 ? anchorIdx : Math.min(2, node.widgets.length - 1);
            if (anchorDomIdx !== anchorTarget) {
                node.widgets.splice(anchorDomIdx, 1);
                node.widgets.splice(anchorTarget, 0, anchorDomW);
            }

            // ── Color picker (replaces custom_color_hex STRING widget) ───────
            // Find AFTER anchor manipulation so indices are current.
            const customColorIdx  = node.widgets?.findIndex(w => w.name === "custom_color_hex") ?? -1;
            const initColor       = customColorIdx >= 0 ? (node.widgets[customColorIdx].value || "#000000") : "#000000";
            if (customColorIdx >= 0) node.widgets.splice(customColorIdx, 1);
            node._customColorValue = initColor;

            const { wrapper: colorWrapper, input: colorInput } = buildColorPicker(
                ()  => node._customColorValue,
                (v) => { node._customColorValue = v; },
            );

            const colorDomW = node.addDOMWidget("custom_color_hex", "COLOR_PICKER", colorWrapper, {
                getValue: () => node._customColorValue,
                setValue: (v) => { node._customColorValue = v; colorInput.value = v; },
            });
            colorDomW.computeSize = () => [200, 36];

            // Slot into the position the STRING widget occupied.
            const colorDomEndIdx = node.widgets.indexOf(colorDomW);
            const colorTarget    = customColorIdx >= 0 ? customColorIdx : colorDomEndIdx;
            if (colorDomEndIdx !== colorTarget) {
                node.widgets.splice(colorDomEndIdx, 1);
                node.widgets.splice(colorTarget, 0, colorDomW);
            }

            // ── Show / hide logic ─────────────────────────────────────────────
            const paddingFillW = node.widgets?.find(w => w.name === "padding_fill");
            const noiseSeedW   = node.widgets?.find(w => w.name === "noise_seed");

            // ComfyUI may auto-add a control widget immediately after noise_seed.
            const noiseSeedIdx = node.widgets?.findIndex(w => w.name === "noise_seed") ?? -1;
            const maybeCtrlW   = noiseSeedIdx >= 0 ? node.widgets[noiseSeedIdx + 1] : null;
            const noiseCtrlW   = (maybeCtrlW && maybeCtrlW.name !== "custom_color_hex") ? maybeCtrlW : null;

            // Remove the custom_color_hex_input slot initially; sync() will add it when needed.
            const removeColorSlot = () => {
                const idx = node.inputs?.findIndex(i => i.name === "custom_color_hex_input") ?? -1;
                if (idx >= 0) node.removeInput(idx);
            };
            removeColorSlot();

            const isColorSlotConnected = () => {
                const idx = node.inputs?.findIndex(i => i.name === "custom_color_hex_input") ?? -1;
                return idx >= 0 && node.inputs[idx].link != null;
            };

            const syncPickerState = () => {
                const connected = isColorSlotConnected();
                colorInput.disabled = connected;
                colorInput.style.opacity = connected ? "0.35" : "1";
                colorInput.style.cursor  = connected ? "not-allowed" : "pointer";
            };

            const sync = () => {
                // Capture size BEFORE any changes so we never shrink a user-resized node.
                const prevW = node.size[0];
                const prevH = node.size[1];

                const val       = paddingFillW?.value;
                const showColor = val === "custom";
                const showNoise = val === "noise";

                // Color picker DOM widget + connector slot
                colorWrapper.style.display = showColor ? "" : "none";
                colorDomW.computeSize = showColor ? () => [200, 36] : () => [0, -4];

                const slotExists = node.inputs?.some(i => i.name === "custom_color_hex_input");
                if (showColor && !slotExists) {
                    node.addInput("custom_color_hex_input", "STRING");
                } else if (!showColor && slotExists) {
                    removeColorSlot();
                }
                syncPickerState();

                // noise_seed (and optional auto-added control widget)
                setWidgetVisible(noiseSeedW, showNoise);
                if (noiseCtrlW) setWidgetVisible(noiseCtrlW, showNoise);

                resizeNode(node, prevW, prevH);
                node.setDirtyCanvas(true);
            };

            if (paddingFillW) {
                const origCb = paddingFillW.callback;
                paddingFillW.callback = (...args) => { origCb?.apply(paddingFillW, args); sync(); };
            }

            // Re-sync when the color slot is connected or disconnected.
            const origOnConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function (slotType, slotIdx, connected, link, ioSlot) {
                origOnConnectionsChange?.apply(this, arguments);
                if (slotType === LiteGraph.INPUT) {
                    const slot = this.inputs?.[slotIdx];
                    if (slot?.name === "custom_color_hex_input") syncPickerState();
                }
            };

            // After a saved workflow restores widget values, re-run sync.
            const origOnConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function (info) {
                origOnConfigure?.apply(this, arguments);
                sync();
            };

            sync();
        };
    },
});

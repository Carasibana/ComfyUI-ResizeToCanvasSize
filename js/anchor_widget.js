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
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:6px 0 18px;width:100%;box-sizing:border-box;gap:4px;";

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
    label.textContent = "Custom colour";
    label.style.cssText = "font-size:12px;color:#ccc;flex:1;line-height:24px;padding-right:8px;";

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

// ─────────────────────────────────────────────────────────────────────────────
// COI 7×7 grid widget (for ResizeToCanvasSizeMask)
// ─────────────────────────────────────────────────────────────────────────────

function buildCOIGrid(getVal, setVal) {
    // Layout constants
    const CELL = 42;          // px per nonant cell
    const CELLS = 3;
    const PAD = 8;            // px padding around the grid area
    const TOTAL = CELL * CELLS;              // 126 px grid area
    const STEP = TOTAL / 6;                  // 21 px between dot columns/rows
    const CS = TOTAL + PAD * 2;             // 142 px canvas size

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:6px 0 18px;width:100%;box-sizing:border-box;gap:4px;";

    const label = document.createElement("div");
    label.textContent = "Canvas Target";
    label.style.cssText = "font-size:11px;color:#aaa;letter-spacing:1px;text-transform:uppercase;";
    wrapper.appendChild(label);

    const cvs = document.createElement("canvas");
    cvs.width  = CS;
    cvs.height = CS;
    cvs.style.cssText = "cursor:crosshair;";

    function parseVal(v) {
        const parts = (v || "3,3").split(",").map(Number);
        if (parts.length === 2 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 6)) {
            return { col: parts[0], row: parts[1] };
        }
        return { col: 3, row: 3 };
    }

    function dotPos(c, r) {
        return { x: PAD + c * STEP, y: PAD + r * STEP };
    }

    function draw() {
        const ctx = cvs.getContext("2d");
        const { col: sc, row: sr } = parseVal(getVal());

        // Background
        ctx.fillStyle = "#1e1e1e";
        ctx.fillRect(0, 0, CS, CS);

        // Nonant cell fills (alternate subtle tint for readability)
        for (let r = 0; r < CELLS; r++) {
            for (let c = 0; c < CELLS; c++) {
                ctx.fillStyle = (r + c) % 2 === 0 ? "#222222" : "#202020";
                ctx.fillRect(PAD + c * CELL, PAD + r * CELL, CELL, CELL);
            }
        }

        // Outer border + inner nonant dividers
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        ctx.strokeRect(PAD - 0.5, PAD - 0.5, TOTAL + 1, TOTAL + 1);

        ctx.strokeStyle = "#383838";
        ctx.lineWidth = 1;
        for (let i = 1; i < CELLS; i++) {
            const px = PAD + i * CELL;
            ctx.beginPath(); ctx.moveTo(px, PAD); ctx.lineTo(px, PAD + TOTAL); ctx.stroke();
            const py = PAD + i * CELL;
            ctx.beginPath(); ctx.moveTo(PAD, py); ctx.lineTo(PAD + TOTAL, py); ctx.stroke();
        }

        // 49 dots at the 7×7 lattice
        for (let r = 0; r <= 6; r++) {
            for (let c = 0; c <= 6; c++) {
                const { x, y } = dotPos(c, r);
                const isSel  = c === sc && r === sr;
                const isBoundary = c % 2 === 0 && r % 2 === 0;  // nonant corner/edge

                ctx.beginPath();
                if (isSel) {
                    ctx.arc(x, y, 6, 0, Math.PI * 2);
                    ctx.fillStyle = "#7fb3ff";
                } else if (isBoundary) {
                    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
                    ctx.fillStyle = "#606060";
                } else {
                    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = "#454545";
                }
                ctx.fill();
            }
        }
    }

    cvs.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const rect = cvs.getBoundingClientRect();
        // Account for CSS scaling (ComfyUI may scale canvas elements)
        const scaleX = cvs.width  / rect.width;
        const scaleY = cvs.height / rect.height;
        const px = (e.clientX - rect.left) * scaleX;
        const py = (e.clientY - rect.top)  * scaleY;

        // Snap to nearest of the 49 dots
        let bestDist = Infinity, bestCol = 3, bestRow = 3;
        for (let r = 0; r <= 6; r++) {
            for (let c = 0; c <= 6; c++) {
                const { x, y } = dotPos(c, r);
                const d = (px - x) ** 2 + (py - y) ** 2;
                if (d < bestDist) { bestDist = d; bestCol = c; bestRow = r; }
            }
        }
        setVal(`${bestCol},${bestRow}`);
        draw();
    });

    wrapper.appendChild(cvs);
    draw();

    return { wrapper, refresh: draw };
}

// ─────────────────────────────────────────────────────────────────────────────

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
            anchorDomW.computeSize = () => [3 * 36 + 4, 3 * 36 + 4 + 40];

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

app.registerExtension({
    name: "ResizeToCanvasSize.COIWidget",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "ResizeToCanvasSizeMask") return;

        const origOnCreated = nodeType.prototype.onNodeCreated;

        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);

            const node = this;

            // ── COI grid (replaces anchor_grid STRING) ───────────────────────
            const anchorIdx  = node.widgets?.findIndex(w => w.name === "anchor_grid") ?? -1;
            const initAnchor = anchorIdx >= 0 ? (node.widgets[anchorIdx].value || "3,3") : "3,3";
            if (anchorIdx >= 0) node.widgets.splice(anchorIdx, 1);
            node._anchorGridValue = initAnchor;

            const { wrapper: gridWrapper, refresh: gridRefresh } = buildCOIGrid(
                ()  => node._anchorGridValue,
                (v) => { node._anchorGridValue = v; },
            );
            node._anchorGridRefresh = gridRefresh;

            const gridDomW = node.addDOMWidget("anchor_grid", "COI_GRID", gridWrapper, {
                getValue: () => node._anchorGridValue,
                setValue: (v) => { node._anchorGridValue = v; gridRefresh(); },
            });
            // Canvas 142px + wrapper overhead (label ~16px + padding 24px + gap 4px)
            gridDomW.computeSize = () => [142, 142 + 44];

            // Slot into the position the STRING widget occupied.
            const gridDomIdx = node.widgets.indexOf(gridDomW);
            const gridTarget = anchorIdx >= 0 ? anchorIdx : Math.min(2, node.widgets.length - 1);
            if (gridDomIdx !== gridTarget) {
                node.widgets.splice(gridDomIdx, 1);
                node.widgets.splice(gridTarget, 0, gridDomW);
            }

            // ── Color picker (replaces custom_color_hex STRING) ──────────────
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

            const colorDomEndIdx = node.widgets.indexOf(colorDomW);
            const colorTarget    = customColorIdx >= 0 ? customColorIdx : colorDomEndIdx;
            if (colorDomEndIdx !== colorTarget) {
                node.widgets.splice(colorDomEndIdx, 1);
                node.widgets.splice(colorTarget, 0, colorDomW);
            }

            // ── Show / hide logic ────────────────────────────────────────────
            const paddingFillW = node.widgets?.find(w => w.name === "padding_fill");
            const noiseSeedW   = node.widgets?.find(w => w.name === "noise_seed");

            const noiseSeedIdx = node.widgets?.findIndex(w => w.name === "noise_seed") ?? -1;
            const maybeCtrlW   = noiseSeedIdx >= 0 ? node.widgets[noiseSeedIdx + 1] : null;
            const noiseCtrlW   = (maybeCtrlW && maybeCtrlW.name !== "custom_color_hex") ? maybeCtrlW : null;

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
                const prevW = node.size[0];
                const prevH = node.size[1];

                const val       = paddingFillW?.value;
                const showColor = val === "custom";
                const showNoise = val === "noise";

                colorWrapper.style.display = showColor ? "" : "none";
                colorDomW.computeSize = showColor ? () => [200, 36] : () => [0, -4];

                const slotExists = node.inputs?.some(i => i.name === "custom_color_hex_input");
                if (showColor && !slotExists) {
                    node.addInput("custom_color_hex_input", "STRING");
                } else if (!showColor && slotExists) {
                    removeColorSlot();
                }
                syncPickerState();

                setWidgetVisible(noiseSeedW, showNoise);
                if (noiseCtrlW) setWidgetVisible(noiseCtrlW, showNoise);

                resizeNode(node, prevW, prevH);
                node.setDirtyCanvas(true);
            };

            if (paddingFillW) {
                const origCb = paddingFillW.callback;
                paddingFillW.callback = (...args) => { origCb?.apply(paddingFillW, args); sync(); };
            }

            const origOnConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function (slotType, slotIdx, connected, link, ioSlot) {
                origOnConnectionsChange?.apply(this, arguments);
                if (slotType === LiteGraph.INPUT) {
                    const slot = this.inputs?.[slotIdx];
                    if (slot?.name === "custom_color_hex_input") syncPickerState();
                }
            };

            const origOnConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function (info) {
                origOnConfigure?.apply(this, arguments);
                sync();
                gridRefresh();
            };

            sync();
        };
    },
});

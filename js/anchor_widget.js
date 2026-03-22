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
// Shared styles for LoadImageToCanvas (injected once)
// ─────────────────────────────────────────────────────────────────────────────

const LITC_STYLE_ID = "litc-node-styles";
if (!document.getElementById(LITC_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = LITC_STYLE_ID;
    style.textContent = `
        .litc-dial-readout {
            font-size: 14px;
            font-weight: 700;
            font-family: 'Courier New', Courier, monospace;
            letter-spacing: 1px;
            color: #e8eaf0;
            text-shadow: 0 0 8px rgba(90,190,255,0.5);
            padding: 2px 10px;
            border-radius: 5px;
            background: rgba(0,0,0,0.30);
            cursor: pointer;
            user-select: none;
            text-align: center;
            min-width: 60px;
            transition: background 0.15s, text-shadow 0.15s;
        }
        .litc-dial-readout:hover {
            background: rgba(90,190,255,0.12);
            text-shadow: 0 0 12px rgba(90,190,255,0.8);
        }
        .litc-dial-edit {
            font-size: 13px;
            font-family: 'Courier New', Courier, monospace;
            width: 70px;
            text-align: center;
            background: rgba(0,0,0,0.55);
            color: #e8eaf0;
            border: 1.5px solid rgba(90,190,255,0.75);
            border-radius: 5px;
            padding: 2px 6px;
            outline: none;
        }
    `;
    document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// buildRotaryDial — canvas knob with diagonal drag, scroll, click-to-edit
// ─────────────────────────────────────────────────────────────────────────────

function buildRotaryDial(getVal, setVal, label) {
    const SIZE        = 62;
    const BASE_SENS   = 0.004;    // pixels-per-unit at zoom=1; scales with value
    const NOISE_THRESH = 8;       // px — vertical movement below this is ignored when horizontal dominates

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;user-select:none;";

    if (label) {
        const lbl = document.createElement("div");
        lbl.textContent = label;
        lbl.style.cssText = "font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:1px;";
        wrapper.appendChild(lbl);
    }

    const cvs = document.createElement("canvas");
    cvs.width  = SIZE;
    cvs.height = SIZE;
    cvs.style.cssText = "cursor:ns-resize;display:block;";

    // ── value readout (click to inline-edit) ─────────────────────────────────
    const readout = document.createElement("div");
    readout.className = "litc-dial-readout";

    function draw() {
        const val = Math.max(0.01, getVal());
        const ctx = cvs.getContext("2d");
        const cx  = SIZE / 2, cy = SIZE / 2;
        const R   = SIZE / 2 - 5;
        const START = -Math.PI * 0.75;
        const SWEEP =  Math.PI * 1.5;

        ctx.clearRect(0, 0, SIZE, SIZE);

        // Background circle
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = "#2a2a2a";
        ctx.fill();
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Grey track
        ctx.beginPath();
        ctx.arc(cx, cy, R - 4, START, START + SWEEP);
        ctx.strokeStyle = "#3a3a3a";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.stroke();

        // Coloured value arc (visual range: 0 – 4×, saturates beyond)
        const t = Math.min(val / 4.0, 1.0);
        const endAngle = START + SWEEP * t;
        if (endAngle > START) {
            ctx.beginPath();
            ctx.arc(cx, cy, R - 4, START, endAngle);
            ctx.strokeStyle = val >= 1.0 ? "#7fb3ff" : "#ffaa55";
            ctx.lineWidth = 5;
            ctx.lineCap = "round";
            ctx.stroke();
        }

        // Indicator line
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(endAngle) * (R - 10), cy + Math.sin(endAngle) * (R - 10));
        ctx.lineTo(cx + Math.cos(endAngle) * R,         cy + Math.sin(endAngle) * R);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();

        readout.textContent = val.toFixed(2) + "×";
    }

    // ── drag handling — diagonal priority ────────────────────────────────────
    // Up or right increases; down or left decreases.
    // Vertical beats horizontal unless drag is strongly horizontal AND vertical is small noise.
    let _dragStartX = 0, _dragStartY = 0, _dragStartVal = 1.0;

    cvs.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        _dragStartX   = e.clientX;
        _dragStartY   = e.clientY;
        _dragStartVal = getVal();
        cvs.setPointerCapture(e.pointerId);
    });

    cvs.addEventListener("pointermove", (e) => {
        if (!cvs.hasPointerCapture(e.pointerId)) return;
        e.stopPropagation();
        const dx = e.clientX - _dragStartX;
        const dy = e.clientY - _dragStartY;

        // Determine effective displacement:
        // Horizontal dominant = |dx| > 2×|dy| AND |dy| < noise threshold
        let delta;
        if (Math.abs(dx) > Math.abs(dy) * 2 && Math.abs(dy) < NOISE_THRESH) {
            delta = dx;   // predominantly horizontal: right = increase
        } else {
            delta = -dy;  // vertical (or diagonal): up = increase
        }

        // Sensitivity scales with current value so large zooms don't jump wildly
        const sens = BASE_SENS * Math.max(0.5, _dragStartVal);
        const newVal = Math.max(0.01, _dragStartVal + delta * sens);
        setVal(newVal);
        draw();
    });

    cvs.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        if (cvs.hasPointerCapture(e.pointerId)) cvs.releasePointerCapture(e.pointerId);
    });

    // ── scroll to nudge ───────────────────────────────────────────────────────
    // Step size is velocity-sensitive: rapid scrolling (small gap between events)
    // uses larger steps; slow/deliberate scrolling uses the fine 0.01 step.
    let _lastNudgeTime = 0;
    function nudge(e) {
        e.stopPropagation();
        e.preventDefault();
        const now = Date.now();
        const dt  = now - _lastNudgeTime;
        _lastNudgeTime = now;
        const step = e.shiftKey ? 0.1
                   : dt < 60   ? 0.05
                   : dt < 120  ? 0.03
                   : dt < 250  ? 0.02
                   : 0.01;
        setVal(Math.max(0.01, getVal() + (e.deltaY < 0 ? step : -step)));
        draw();
    }
    cvs.addEventListener("wheel",    nudge, { passive: false });
    readout.addEventListener("wheel", nudge, { passive: false });

    // ── click readout → inline edit (sister project fsn-edit pattern) ────────
    readout.addEventListener("click", () => {
        const edit = document.createElement("input");
        edit.type = "number";
        edit.className = "litc-dial-edit";
        edit.value = getVal().toFixed(2);
        edit.step  = "0.01";
        edit.min   = "0.01";
        readout.replaceWith(edit);
        edit.focus();
        edit.select();

        function commit() {
            const parsed = parseFloat(edit.value);
            if (!isNaN(parsed) && parsed >= 0.01) setVal(parsed);
            draw();
            edit.replaceWith(readout);
        }
        edit.addEventListener("blur", commit);
        edit.addEventListener("keydown", (e) => {
            if (e.key === "Enter")  { e.preventDefault(); commit(); }
            if (e.key === "Escape") { edit.replaceWith(readout); }
        });
    });

    wrapper.appendChild(cvs);
    wrapper.appendChild(readout);
    draw();

    return { wrapper, draw };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPreviewCanvas — live composite preview with drag, scroll-zoom, shift+drag crop
// ─────────────────────────────────────────────────────────────────────────────

function buildPreviewCanvas(node) {
    const PREVIEW_W = 250;

    // pointer-events:none on wrapper so DOM overlay doesn't block canvas widgets below.
    // The interactive canvas inside sets pointer-events:auto to receive its own events.
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;width:100%;padding:6px 0 2px;box-sizing:border-box;gap:4px;pointer-events:none;";

    // Swap W↔H button — right-aligned row at the top of the preview widget.
    // Lives here (not as a separate DOM widget) so it shares the preview's pointer-events
    // context and never blocks the canvas drag/scroll handlers below it.
    const swapRow = document.createElement("div");
    swapRow.style.cssText = "display:flex;justify-content:flex-end;width:100%;padding:0 4px;box-sizing:border-box;pointer-events:none;";
    const swapBtn = document.createElement("button");
    swapBtn.title = "Swap canvas width and height";
    swapBtn.innerHTML = "&#x21C4;&thinsp;Swap W&#x21D4;H";
    swapBtn.style.cssText = "padding:2px 8px;border-radius:4px;font-size:10px;cursor:pointer;border:1px solid #555;background:#2a2a2a;color:#ccc;transition:background 0.1s;pointer-events:auto;";
    swapBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    swapBtn.addEventListener("mouseenter", () => { swapBtn.style.background = "#3a3a3a"; });
    swapBtn.addEventListener("mouseleave", () => { swapBtn.style.background = "#2a2a2a"; });
    swapBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wW = getW("canvas_width");
        const wH = getW("canvas_height");
        if (!wW || !wH) return;
        const tmp = wW.value;
        wW.value = wH.value;
        wH.value = tmp;
        // Fire the wrapped callbacks so the widget display updates and the node resizes.
        wW.callback?.(wW.value);
        wH.callback?.(wH.value);
    });
    swapRow.appendChild(swapBtn);
    wrapper.appendChild(swapRow);

    const lbl = document.createElement("div");
    lbl.textContent = "Preview";
    lbl.style.cssText = "font-size:11px;color:#aaa;letter-spacing:1px;text-transform:uppercase;";
    wrapper.appendChild(lbl);

    const cvs = document.createElement("canvas");
    cvs.style.cssText = "border:1px solid #444;border-radius:3px;cursor:crosshair;display:block;pointer-events:auto;";
    wrapper.appendChild(cvs);

    // Resolution label — sits just below the preview canvas, always visible.
    // Text is set on every redraw() call so it stays in sync with canvas_width/canvas_height.
    const resLabel = document.createElement("div");
    resLabel.style.cssText = "font-size:11px;font-family:monospace;color:#bbb;background:rgba(0,0,0,0.4);padding:2px 10px;border-radius:3px;pointer-events:none;";
    wrapper.appendChild(resLabel);

    let _srcImg = null, _currentFilename = null;

    function getW(name) { return node.widgets?.find(w => w.name === name); }

    function getParams() {
        return {
            canvasWidth:  Math.max(1, parseInt(getW("canvas_width")?.value  || 512)),
            canvasHeight: Math.max(1, parseInt(getW("canvas_height")?.value || 512)),
            paddingFill:  getW("padding_fill")?.value || "black",
            customColor:  node._litcColorValue || "#000000",
            zoomX:        node._litcZoomX  || 1.0,
            zoomY:        node._litcZoomY  || 1.0,
            offsetX:      parseFloat(getW("offset_x")?.value  ?? 0.5),
            offsetY:      parseFloat(getW("offset_y")?.value  ?? 0.5),
            flipH:        getW("flip_horizontal")?.value === true,
            flipV:        getW("flip_vertical")?.value   === true,
        };
    }

    function loadImage(filename) {
        if (!filename || filename === _currentFilename) return;
        _currentFilename = filename;
        const img = new Image();
        img.onload  = () => { _srcImg = img; redraw(); };
        img.onerror = () => { _srcImg = null; redraw(); };
        img.src = `/view?filename=${encodeURIComponent(filename)}&type=input`;
    }

    let _cropBox = null; // { x1, y1, x2, y2 } in preview canvas pixels, null when inactive

    // Use the wrapper's actual rendered width so the preview fills the node as it's resized.
    // Falls back to PREVIEW_W before the wrapper is in the DOM.
    function getPreviewW() {
        return wrapper.clientWidth > 50 ? wrapper.clientWidth - 4 : PREVIEW_W;
    }

    function redraw() {
        const p     = getParams();
        resLabel.textContent = `${p.canvasWidth} \u00d7 ${p.canvasHeight}`;
        resLabel.style.visibility = "visible";
        const prevW = getPreviewW();
        const prevH = Math.max(1, Math.round(prevW * p.canvasHeight / p.canvasWidth));

        cvs.width  = prevW;
        cvs.height = prevH;
        cvs.style.width  = prevW + "px";
        cvs.style.height = prevH + "px";

        const ctx = cvs.getContext("2d");

        // Background fill
        if (p.paddingFill === "transparent") {
            ctx.clearRect(0, 0, prevW, prevH);
            for (let y = 0; y < prevH; y += 8)
                for (let x = 0; x < prevW; x += 8) {
                    ctx.fillStyle = ((Math.floor(x/8) + Math.floor(y/8)) % 2 === 0) ? "#888" : "#aaa";
                    ctx.fillRect(x, y, 8, 8);
                }
        } else {
            const fillMap = { black:"#000", white:"#fff", gray_50:"#808080", noise:"#555" };
            ctx.fillStyle = fillMap[p.paddingFill] || p.customColor || "#000";
            ctx.fillRect(0, 0, prevW, prevH);
        }

        if (_srcImg && _srcImg.naturalWidth) {
            const srcW = _srcImg.naturalWidth, srcH = _srcImg.naturalHeight;
            const cw = p.canvasWidth, ch = p.canvasHeight;

            const zoomedW = Math.max(1, Math.round(srcW * p.zoomX));
            const zoomedH = Math.max(1, Math.round(srcH * p.zoomY));
            const pasteX  = p.offsetX * cw - zoomedW / 2;
            const pasteY  = p.offsetY * ch - zoomedH / 2;
            const ps = prevW / cw;
            const px = pasteX * ps, py = pasteY * ps;
            const pw = zoomedW * ps, ph = zoomedH * ps;

            ctx.save();
            ctx.beginPath(); ctx.rect(0, 0, prevW, prevH); ctx.clip();
            ctx.translate(px + pw / 2, py + ph / 2);
            if (p.flipH) ctx.scale(-1,  1);
            if (p.flipV) ctx.scale( 1, -1);
            ctx.drawImage(_srcImg, -pw / 2, -ph / 2, pw, ph);
            ctx.restore();
        }

        // Shift+drag crop box overlay
        if (_cropBox) {
            const { x1, y1, x2, y2 } = _cropBox;
            const vx1 = Math.max(0, x1), vy1 = Math.max(0, y1);
            const vx2 = Math.min(prevW, x2), vy2 = Math.min(prevH, y2);
            if (vx2 > vx1 && vy2 > vy1) {
                ctx.save();
                ctx.fillStyle = "rgba(0,0,0,0.45)";
                ctx.fillRect(0, 0, prevW, vy1);
                ctx.fillRect(0, vy1, vx1, vy2 - vy1);
                ctx.fillRect(vx2, vy1, prevW - vx2, vy2 - vy1);
                ctx.fillRect(0, vy2, prevW, prevH - vy2);
                ctx.strokeStyle = "rgba(255,255,255,0.9)";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(vx1, vy1, vx2 - vx1, vy2 - vy1);
                ctx.restore();
            }
        }

    }

    // ── pointer handling ───────────────────────────────────────────────────────
    let _isDragging = false, _isShiftDrag = false;
    let _dragSX = 0, _dragSY = 0, _dragOX = 0.5, _dragOY = 0.5;
    let _cropStart = null;

    cvs.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        cvs.setPointerCapture(e.pointerId);
        if (e.shiftKey) {
            _isShiftDrag = true;
            _isDragging  = false;
            const rect = cvs.getBoundingClientRect();
            const sx = cvs.width / rect.width, sy = cvs.height / rect.height;
            _cropStart = { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
            _cropBox = { x1: _cropStart.x, y1: _cropStart.y, x2: _cropStart.x, y2: _cropStart.y };
        } else {
            _isDragging  = true;
            _isShiftDrag = false;
            _cropBox     = null;
            _dragSX = e.clientX; _dragSY = e.clientY;
            _dragOX = parseFloat(getW("offset_x")?.value ?? 0.5);
            _dragOY = parseFloat(getW("offset_y")?.value ?? 0.5);
        }
    });

    cvs.addEventListener("pointermove", (e) => {
        if (!cvs.hasPointerCapture(e.pointerId)) return;
        e.stopPropagation();
        if (_isShiftDrag && _cropStart) {
            const p = getParams();
            const rect = cvs.getBoundingClientRect();
            const scX = cvs.width / rect.width, scY = cvs.height / rect.height;
            const ex = (e.clientX - rect.left) * scX;
            const ey = (e.clientY - rect.top)  * scY;
            // Enforce canvas aspect ratio on the drag box
            const aspect = p.canvasWidth / p.canvasHeight;
            const rawDx = ex - _cropStart.x, rawDy = ey - _cropStart.y;
            let bw = Math.abs(rawDx), bh = Math.abs(rawDy);
            if (bw / Math.max(1, bh) > aspect) { bh = bw / aspect; } else { bw = bh * aspect; }
            const bx1 = rawDx >= 0 ? _cropStart.x : _cropStart.x - bw;
            const by1 = rawDy >= 0 ? _cropStart.y : _cropStart.y - bh;
            _cropBox = { x1: bx1, y1: by1, x2: bx1 + bw, y2: by1 + bh };
            redraw();
        } else if (_isDragging) {
            const p  = getParams();
            const ps = getPreviewW() / p.canvasWidth;
            const dx = (e.clientX - _dragSX) / ps / p.canvasWidth;
            const dy = (e.clientY - _dragSY) / ps / p.canvasHeight;
            const ox = getW("offset_x"), oy = getW("offset_y");
            if (ox) ox.value = Math.max(-1, Math.min(2, _dragOX + dx));
            if (oy) oy.value = Math.max(-1, Math.min(2, _dragOY + dy));
            redraw();
        }
    });

    cvs.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        if (!cvs.hasPointerCapture(e.pointerId)) return;
        cvs.releasePointerCapture(e.pointerId);
        if (_isShiftDrag && _cropBox) applyCropBox();
        _isDragging = _isShiftDrag = false;
        _cropStart = _cropBox = null;
        redraw();
    });

    // Apply crop box: zoom in so the selected box fills the canvas.
    // Formula: k = PREVIEW_W / box_width (zoom multiplier)
    //   new_zoom = current_zoom * k
    //   new_offset = 0.5 + k * (current_offset - box_centre_normalised)
    function applyCropBox() {
        const { x1, y1, x2, y2 } = _cropBox;
        const bw = x2 - x1, bh = y2 - y1;
        if (bw < 4 || bh < 4) return;
        const p = getParams();
        const pw = getPreviewW();
        const prevH = Math.max(1, Math.round(pw * p.canvasHeight / p.canvasWidth));
        const k = pw / bw;
        const cbxNorm = (x1 + x2) / 2 / pw;
        const cbyNorm = (y1 + y2) / 2 / prevH;
        node._litcZoomX = Math.max(0.01, p.zoomX * k);
        node._litcZoomY = Math.max(0.01, p.zoomY * k);
        if (node._litcLocked) {
            node._litcLockedRatio = node._litcZoomX / Math.max(0.0001, node._litcZoomY);
        }
        const oxW = getW("offset_x"), oyW = getW("offset_y");
        if (oxW) oxW.value = Math.max(-1, Math.min(2, 0.5 + k * (p.offsetX - cbxNorm)));
        if (oyW) oyW.value = Math.max(-1, Math.min(2, 0.5 + k * (p.offsetY - cbyNorm)));
        if (node._litcRedrawDials) node._litcRedrawDials();
        redraw();
    }

    // ── scroll to zoom ─────────────────────────────────────────────────────────
    // Same velocity-sensitive step as the rotary dials.
    let _previewScrollTime = 0;
    cvs.addEventListener("wheel", (e) => {
        e.stopPropagation();
        e.preventDefault();
        const now = Date.now();
        const dt  = now - _previewScrollTime;
        _previewScrollTime = now;
        const step  = e.shiftKey ? 0.1
                    : dt < 60   ? 0.05
                    : dt < 120  ? 0.03
                    : dt < 250  ? 0.02
                    : 0.01;
        const delta = e.deltaY < 0 ? step : -step;
        node._litcZoomX = Math.max(0.01, (node._litcZoomX || 1.0) + delta);
        if (node._litcLocked) {
            node._litcZoomY = node._litcZoomX / (node._litcLockedRatio || 1.0);
        } else {
            node._litcZoomY = Math.max(0.01, (node._litcZoomY || 1.0) + delta);
        }
        if (node._litcRedrawDials) node._litcRedrawDials();
        redraw();
    }, { passive: false });

    // Snap to canvas width or height.
    // With aspect locked: uniform scale so the image fills that canvas axis, offset centred.
    // With aspect unlocked: scale only the corresponding zoom axis, centre only that offset.
    function snapTo(direction) {
        if (!_srcImg || !_srcImg.naturalWidth) return;
        const srcW = _srcImg.naturalWidth, srcH = _srcImg.naturalHeight;
        const p = getParams();
        if (direction === "width") {
            const s = p.canvasWidth / srcW;
            node._litcZoomX = s;
            if (node._litcLocked) { node._litcZoomY = s; node._litcLockedRatio = 1.0; }
            const ox = getW("offset_x"); if (ox) ox.value = 0.5;
            if (node._litcLocked) { const oy = getW("offset_y"); if (oy) oy.value = 0.5; }
        } else {
            const s = p.canvasHeight / srcH;
            node._litcZoomY = s;
            if (node._litcLocked) { node._litcZoomX = s; node._litcLockedRatio = 1.0; }
            const oy = getW("offset_y"); if (oy) oy.value = 0.5;
            if (node._litcLocked) { const ox = getW("offset_x"); if (ox) ox.value = 0.5; }
        }
        if (node._litcRedrawDials) node._litcRedrawDials();
        redraw();
    }

    function computePreviewHeight() {
        const cw = Math.max(1, parseInt(getW("canvas_width")?.value  || 512));
        const ch = Math.max(1, parseInt(getW("canvas_height")?.value || 512));
        // Use node.size[0] for layout-phase calls — wrapper.clientWidth may not have reflowed yet.
        const nodeW = (node.size?.[0] || PREVIEW_W + 4) - 4;
        // top-padding(6) + swap-row(22) + gap(4) + "PREVIEW" label(15) + gap(4) + gap(4) + res-label(16) + bottom-padding(2) = 73px overhead
        return Math.round(Math.max(PREVIEW_W, nodeW) * ch / cw) + 73;
    }

    return { wrapper, redraw, loadImage, computePreviewHeight, snapTo };
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
            const origOnConnectionsChange = node.onConnectionsChange;
            node.onConnectionsChange = function (slotType, slotIdx, connected, link, ioSlot) {
                origOnConnectionsChange?.apply(this, arguments);
                if (slotType === LiteGraph.INPUT) {
                    const slot = this.inputs?.[slotIdx];
                    if (slot?.name === "custom_color_hex_input") syncPickerState();
                }
            };

            // After a saved workflow restores widget values, re-run sync.
            const origOnConfigure = node.onConfigure;
            node.onConfigure = function (info) {
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

            const origOnConnectionsChange = node.onConnectionsChange;
            node.onConnectionsChange = function (slotType, slotIdx, connected, link, ioSlot) {
                origOnConnectionsChange?.apply(this, arguments);
                if (slotType === LiteGraph.INPUT) {
                    const slot = this.inputs?.[slotIdx];
                    if (slot?.name === "custom_color_hex_input") syncPickerState();
                }
            };

            const origOnConfigure = node.onConfigure;
            node.onConfigure = function (info) {
                origOnConfigure?.apply(this, arguments);
                sync();
                gridRefresh();
            };

            sync();
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// LoadImageToCanvas — live preview, rotary zoom dials, lock button, colour picker
// ─────────────────────────────────────────────────────────────────────────────

app.registerExtension({
    name: "ResizeToCanvasSize.LoadImageToCanvasWidget",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "LoadImageToCanvas") return;

        // Fix 3: suppress ComfyUI's built-in image preview (we have our own preview widget).
        // Temporarily null node.imgs during background drawing so the base class doesn't render it.
        const origOnDrawBackground = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (...args) {
            const savedImgs = this.imgs;
            this.imgs = null;
            origOnDrawBackground?.apply(this, args);
            this.imgs = savedImgs;
        };

        const origOnCreated = nodeType.prototype.onNodeCreated;

        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);
            const node = this;

            const getW = (name) => node.widgets?.find(w => w.name === name);

            // ── Initialise internal state ─────────────────────────────────────
            node._litcZoomX       = parseFloat(getW("zoom_x")?.value        ?? 1.0);
            node._litcZoomY       = parseFloat(getW("zoom_y")?.value        ?? 1.0);
            node._litcLockedRatio = parseFloat(getW("locked_ratio")?.value  ?? 1.0);
            node._litcColorValue  = getW("custom_color_hex")?.value         ?? "#000000";
            node._litcLocked      = getW("lock_aspect_ratio")?.value        !== false; // default true

            // ── Build preview ─────────────────────────────────────────────────
            const previewObj = buildPreviewCanvas(node);

            const previewDomW = node.addDOMWidget(
                "_litc_preview", "LITC_PREVIEW", previewObj.wrapper,
                { getValue: () => "", setValue: () => {} },
            );
            previewDomW.computeSize = () => [250, previewObj.computePreviewHeight()];

            // Slot preview immediately after canvas_height
            const canvasHeightIdx  = node.widgets.findIndex(w => w.name === "canvas_height");
            const previewTarget    = canvasHeightIdx >= 0 ? canvasHeightIdx + 1 : node.widgets.indexOf(previewDomW);
            const previewDomIdxNow = node.widgets.indexOf(previewDomW);
            if (previewDomIdxNow !== previewTarget) {
                node.widgets.splice(previewDomIdxNow, 1);
                node.widgets.splice(previewTarget, 0, previewDomW);
            }

            // ── Build zoom area ───────────────────────────────────────────────
            // Remove standard zoom_x, zoom_y, locked_ratio, lock_aspect_ratio widgets.
            const zoomXIdx       = node.widgets.findIndex(w => w.name === "zoom_x");
            const zoomYIdx       = node.widgets.findIndex(w => w.name === "zoom_y");
            const lockedRatioIdx = node.widgets.findIndex(w => w.name === "locked_ratio");
            const lockAspectIdx  = node.widgets.findIndex(w => w.name === "lock_aspect_ratio");
            [lockedRatioIdx, zoomYIdx, zoomXIdx, lockAspectIdx]
                .filter(i => i >= 0).sort((a, b) => b - a)
                .forEach(i => node.widgets.splice(i, 1));

            // Slot zoom area right after the preview widget
            const zoomAreaTarget = previewTarget + 1;

            // pointer-events:none on the outer wrapper; interactive children set their own auto.
            const zoomAreaWrapper = document.createElement("div");
            zoomAreaWrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;width:100%;padding:4px 0 6px;box-sizing:border-box;gap:4px;pointer-events:none;";

            const zoomAreaLabel = document.createElement("div");
            zoomAreaLabel.textContent = "Zoom";
            zoomAreaLabel.style.cssText = "font-size:11px;color:#aaa;letter-spacing:1px;text-transform:uppercase;";
            zoomAreaWrapper.appendChild(zoomAreaLabel);

            // Snap button factory — instances placed in both locked and unlocked dial rows.
            // With aspect locked: uniform scale to fill the chosen canvas axis; both offsets centred.
            // With aspect unlocked: scale only the corresponding zoom axis; centre only that offset.
            function makeSnapBtn(label) {
                const b = document.createElement("button");
                b.textContent = label;
                b.style.cssText = "padding:3px 10px;border-radius:4px;font-size:11px;cursor:pointer;border:1px solid #555;background:#2a2a2a;color:#ccc;transition:background 0.1s;pointer-events:auto;";
                b.addEventListener("pointerdown", (e) => e.stopPropagation());
                b.addEventListener("mouseenter", () => { b.style.background = "#3a3a3a"; });
                b.addEventListener("mouseleave", () => { b.style.background = "#2a2a2a"; });
                return b;
            }

            // Aspect ratio lock convention:
            //   locked_ratio = zoom_x / zoom_y at lock time.
            //   Unified dial = zoom_x; zoom_y = zoom_x / locked_ratio.
            //   This preserves the x:y ratio established while unlocked.
            //
            // Two fully separate views switched by syncZoomLayout.
            // Each view is a self-contained element so ComfyUI's block layout stacks them
            // predictably; only one is visible at a time.
            function makeLockBtn(locked) {
                const b = document.createElement("button");
                b.style.cssText = "padding:3px 12px;border-radius:4px;font-size:12px;cursor:pointer;border:1px solid #555;transition:background 0.15s,border-color 0.15s;display:block;margin:0 auto;";
                b.style.background  = locked ? "#3a4a5a" : "#2a2a2a";
                b.style.color       = locked ? "#7fb3ff" : "#aaa";
                b.style.borderColor = locked ? "#5a8ab8" : "#555";
                b.textContent       = locked ? "🔒 Aspect Ratio Locked" : "🔓 Aspect Ratio Unlocked";
                b.addEventListener("pointerdown", (e) => e.stopPropagation());
                return b;
            }

            // Locked view: lock button + [Fit Width] [unified dial] [Fit Height]
            // pointer-events:none on the container — only explicit interactive children get auto.
            const lockedView = document.createElement("div");
            lockedView.style.cssText = "width:100%;pointer-events:none;";
            const lockBtnLocked = makeLockBtn(true);
            lockBtnLocked.style.pointerEvents = "auto";
            const { wrapper: unifiedDialW, draw: drawUnified } = buildRotaryDial(
                () => node._litcZoomX,
                (v) => {
                    node._litcZoomX = v;
                    node._litcZoomY = v / (node._litcLockedRatio || 1.0);
                    previewObj.redraw();
                },
                null,
            );
            unifiedDialW.style.pointerEvents = "auto";
            const lockedDialRow = document.createElement("div");
            lockedDialRow.style.cssText = "display:flex;align-items:center;justify-content:center;gap:8px;pointer-events:auto;";
            const fitWidthBtnL  = makeSnapBtn("Fit Width");
            const fitHeightBtnL = makeSnapBtn("Fit Height");
            fitWidthBtnL.addEventListener("click",  (e) => { e.stopPropagation(); previewObj.snapTo("width"); });
            fitHeightBtnL.addEventListener("click", (e) => { e.stopPropagation(); previewObj.snapTo("height"); });
            lockedDialRow.appendChild(fitWidthBtnL);
            lockedDialRow.appendChild(unifiedDialW);
            lockedDialRow.appendChild(fitHeightBtnL);
            lockedView.appendChild(lockBtnLocked);
            lockedView.appendChild(lockedDialRow);
            zoomAreaWrapper.appendChild(lockedView);

            // Unlocked view: lock button + [Fit Width] [Width dial] [=] [Height dial] [Fit Height]
            // Same pointer-events strategy: none on container, auto on interactive children.
            const unlockedView = document.createElement("div");
            unlockedView.style.cssText = "width:100%;pointer-events:none;";
            const lockBtnUnlocked = makeLockBtn(false);
            lockBtnUnlocked.style.pointerEvents = "auto";
            const bothDialsRow = document.createElement("div");
            bothDialsRow.style.cssText = "display:inline-flex;flex-direction:row;align-items:center;gap:12px;";
            const { wrapper: dialXW, draw: drawX } = buildRotaryDial(
                () => node._litcZoomX,
                (v) => { node._litcZoomX = v; previewObj.redraw(); },
                "Width",
            );
            const { wrapper: dialYW, draw: drawY } = buildRotaryDial(
                () => node._litcZoomY,
                (v) => { node._litcZoomY = v; previewObj.redraw(); },
                "Height",
            );
            dialXW.style.pointerEvents = "auto";
            dialYW.style.pointerEvents = "auto";
            // "=" button — copies Width zoom to Height zoom, restoring the image's natural aspect ratio
            const equalizeBtn = document.createElement("button");
            equalizeBtn.textContent = "=";
            equalizeBtn.title = "Match Height zoom to Width zoom";
            equalizeBtn.style.cssText = "padding:4px 8px;border-radius:4px;font-size:14px;font-weight:bold;cursor:pointer;border:1px solid #555;background:#2a2a2a;color:#ccc;transition:background 0.1s;pointer-events:auto;";
            equalizeBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
            equalizeBtn.addEventListener("mouseenter", () => { equalizeBtn.style.background = "#3a3a3a"; });
            equalizeBtn.addEventListener("mouseleave", () => { equalizeBtn.style.background = "#2a2a2a"; });
            equalizeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                node._litcZoomY = node._litcZoomX;
                if (node._litcRedrawDials) node._litcRedrawDials();
                previewObj.redraw();
            });
            bothDialsRow.appendChild(dialXW);
            bothDialsRow.appendChild(equalizeBtn);
            bothDialsRow.appendChild(dialYW);
            const unlockedDialRow = document.createElement("div");
            unlockedDialRow.style.cssText = "display:flex;align-items:center;justify-content:center;gap:8px;pointer-events:auto;";
            const fitWidthBtnU  = makeSnapBtn("Fit Width");
            const fitHeightBtnU = makeSnapBtn("Fit Height");
            fitWidthBtnU.addEventListener("click",  (e) => { e.stopPropagation(); previewObj.snapTo("width"); });
            fitHeightBtnU.addEventListener("click", (e) => { e.stopPropagation(); previewObj.snapTo("height"); });
            unlockedDialRow.appendChild(fitWidthBtnU);
            unlockedDialRow.appendChild(bothDialsRow);
            unlockedDialRow.appendChild(fitHeightBtnU);
            unlockedView.appendChild(lockBtnUnlocked);
            unlockedView.appendChild(unlockedDialRow);
            zoomAreaWrapper.appendChild(unlockedView);

            node._litcRedrawDials = () => {
                if (node._litcLocked) drawUnified(); else { drawX(); drawY(); }
            };

            // zoomDomW declared early so syncZoomLayout can update its computeSize
            let zoomDomW = null;

            function syncZoomLayout() {
                const locked = node._litcLocked;
                // Use explicit display values — never "" which would reset display:block to
                // the browser default and lose the layout we set in cssText.
                lockedView.style.display   = locked ? "block" : "none";
                unlockedView.style.display = locked ? "none"  : "block";
                // label(~20) + lockBtn(~30) + dial row (locked ~90, unlocked ~105) + gaps
                if (zoomDomW) zoomDomW.computeSize = () => [250, locked ? 165 : 180];
                if (locked) {
                    node._litcLockedRatio = node._litcZoomX / (node._litcZoomY || 0.01);
                    node._litcZoomY = node._litcZoomX / node._litcLockedRatio;
                    drawUnified();
                } else {
                    drawX(); drawY();
                }
            }

            function toggleLock() {
                node._litcLocked = !node._litcLocked;
                syncZoomLayout();
                resizeNode(node, node.size[0], node.size[1]);
                node.setDirtyCanvas(true);
                previewObj.redraw();
            }
            lockBtnLocked.addEventListener("click",   (e) => { e.stopPropagation(); toggleLock(); });
            lockBtnUnlocked.addEventListener("click", (e) => { e.stopPropagation(); toggleLock(); });

            zoomDomW = node.addDOMWidget("zoom_x", "LITC_ZOOM", zoomAreaWrapper, {
                getValue: () => node._litcZoomX,
                setValue: (v) => { node._litcZoomX = parseFloat(v) || 1.0; node._litcRedrawDials(); },
            });
            zoomDomW.computeSize = () => [250, node._litcLocked ? 165 : 180];

            // Hidden DOM widgets to serialise zoom_y, locked_ratio, lock_aspect_ratio
            const zoomYHolder = document.createElement("div");
            zoomYHolder.style.display = "none";
            const zoomYDomW = node.addDOMWidget("zoom_y", "LITC_ZOOM_Y", zoomYHolder, {
                getValue: () => node._litcZoomY,
                setValue: (v) => { node._litcZoomY = parseFloat(v) || 1.0; },
            });
            zoomYDomW.computeSize = () => [0, -4];

            const lockedRatioHolder = document.createElement("div");
            lockedRatioHolder.style.display = "none";
            const lockedRatioDomW = node.addDOMWidget("locked_ratio", "LITC_RATIO", lockedRatioHolder, {
                getValue: () => node._litcLockedRatio,
                setValue: (v) => { node._litcLockedRatio = parseFloat(v) || 1.0; },
            });
            lockedRatioDomW.computeSize = () => [0, -4];

            const lockHolder = document.createElement("div");
            lockHolder.style.display = "none";
            const lockDomW = node.addDOMWidget("lock_aspect_ratio", "LITC_LOCK", lockHolder, {
                getValue: () => node._litcLocked,
                setValue: (v) => { node._litcLocked = (v === true || v === "true"); },
            });
            lockDomW.computeSize = () => [0, -4];

            // Slot zoom area into position
            const zoomDomCurrentIdx = node.widgets.indexOf(zoomDomW);
            if (zoomDomCurrentIdx !== zoomAreaTarget) {
                node.widgets.splice(zoomDomCurrentIdx, 1);
                node.widgets.splice(zoomAreaTarget, 0, zoomDomW);
            }

            syncZoomLayout();

            // ── Colour picker ─────────────────────────────────────────────────
            const customColorIdx = node.widgets.findIndex(w => w.name === "custom_color_hex");
            const initColor      = customColorIdx >= 0 ? (node.widgets[customColorIdx].value || "#000000") : "#000000";
            if (customColorIdx >= 0) node.widgets.splice(customColorIdx, 1);
            node._litcColorValue = initColor;

            const { wrapper: colorWrapper, input: colorInput } = buildColorPicker(
                ()  => node._litcColorValue,
                (v) => { node._litcColorValue = v; previewObj.redraw(); },
            );
            // Fix 4: pointer-events:none on wrapper, auto on the input
            colorWrapper.style.pointerEvents = "none";
            colorInput.style.pointerEvents   = "auto";

            const colorDomW = node.addDOMWidget("custom_color_hex", "COLOR_PICKER", colorWrapper, {
                getValue: () => node._litcColorValue,
                setValue: (v) => { node._litcColorValue = v; colorInput.value = v; previewObj.redraw(); },
            });
            colorDomW.computeSize = () => [200, 36];

            const colorDomEndIdx = node.widgets.indexOf(colorDomW);
            const colorTarget    = customColorIdx >= 0 ? customColorIdx : colorDomEndIdx;
            if (colorDomEndIdx !== colorTarget) {
                node.widgets.splice(colorDomEndIdx, 1);
                node.widgets.splice(colorTarget, 0, colorDomW);
            }

            // ── Show / hide (padding_fill driven) ────────────────────────────
            const paddingFillW = getW("padding_fill");
            const noiseSeedW   = getW("noise_seed");
            const nsSeedIdx    = node.widgets.findIndex(w => w.name === "noise_seed");
            const maybeCtrl    = nsSeedIdx >= 0 ? node.widgets[nsSeedIdx + 1] : null;
            const noiseCtrlW   = (maybeCtrl && maybeCtrl.name !== "custom_color_hex") ? maybeCtrl : null;

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
                const prevW = node.size[0], prevH = node.size[1];
                const val       = paddingFillW?.value;
                const showColor = val === "custom";
                const showNoise = val === "noise";

                colorWrapper.style.display = showColor ? "" : "none";
                colorDomW.computeSize = showColor ? () => [200, 36] : () => [0, -4];

                const slotExists = node.inputs?.some(i => i.name === "custom_color_hex_input");
                if (showColor && !slotExists) node.addInput("custom_color_hex_input", "STRING");
                else if (!showColor && slotExists) removeColorSlot();
                syncPickerState();

                setWidgetVisible(noiseSeedW, showNoise);
                if (noiseCtrlW) setWidgetVisible(noiseCtrlW, showNoise);
                resizeNode(node, prevW, prevH);
                node.setDirtyCanvas(true);
            };

            if (paddingFillW) {
                const origCb = paddingFillW.callback;
                paddingFillW.callback = (...args) => { origCb?.apply(paddingFillW, args); sync(); previewObj.redraw(); };
            }

            // ── Reactive preview updates ──────────────────────────────────────
            ["flip_horizontal","flip_vertical","offset_x","offset_y"].forEach(name => {
                const w = getW(name);
                if (!w) return;
                const orig = w.callback;
                w.callback = (...args) => { orig?.apply(w, args); previewObj.redraw(); };
            });

            ["canvas_width","canvas_height"].forEach(name => {
                const w = getW(name);
                if (!w) return;
                const orig = w.callback;
                w.callback = (...args) => {
                    orig?.apply(w, args);
                    previewDomW.computeSize = () => [250, previewObj.computePreviewHeight()];
                    resizeNode(node, node.size[0], node.size[1]);
                    previewObj.redraw();
                };
            });

            // image file picker triggers preview image load
            const imageW = getW("image");
            if (imageW) {
                const origCb = imageW.callback;
                imageW.callback = (...args) => {
                    origCb?.apply(imageW, args);
                    previewObj.loadImage(imageW.value);
                    previewObj.redraw();
                };
                if (imageW.value) previewObj.loadImage(imageW.value);
            }

            // ── Resize: redraw preview at new width ───────────────────────────
            // Instance-level (not prototype) so copies don't cross-contaminate.
            const origOnResize = node.onResize;
            node.onResize = function (...args) {
                origOnResize?.apply(this, args);
                // Defer one frame so the DOM has reflowed to the new width before we read it
                requestAnimationFrame(() => {
                    previewDomW.computeSize = () => [node.size[0], previewObj.computePreviewHeight()];
                    previewObj.redraw();
                });
            };

            // ── Connection changes (colour slot) ──────────────────────────────
            const origOnConnectionsChange = node.onConnectionsChange;
            node.onConnectionsChange = function (slotType, slotIdx, connected, link, ioSlot) {
                origOnConnectionsChange?.apply(this, arguments);
                if (slotType === LiteGraph.INPUT) {
                    const slot = this.inputs?.[slotIdx];
                    if (slot?.name === "custom_color_hex_input") syncPickerState();
                }
            };

            // ── Restore from saved workflow ───────────────────────────────────
            const origOnConfigure = node.onConfigure;
            node.onConfigure = function (info) {
                origOnConfigure?.apply(this, arguments);

                // ComfyUI adds the image-upload button after onNodeCreated finishes,
                // so during configure() (clone / workflow load) the button sits at the
                // END of the widget list.  The saved widgets_values was produced with
                // the button already at index 1 (after the initial RAF-move on first
                // creation), so the sparse indices are misaligned unless we move it
                // to index 1 here — BEFORE the re-apply loop — so the indices match.
                const uploadBtnIdx = this.widgets?.findIndex(w => w.type === "button");
                if (uploadBtnIdx > 1) {
                    const [btn] = this.widgets.splice(uploadBtnIdx, 1);
                    this.widgets.splice(1, 0, btn);
                }

                // Fix: LiteGraph's serialize() builds widgets_values with SPARSE
                // widget indices — `widgets_values[i] = val`, leaving null holes
                // at every widget where serialize === false (e.g. the image-upload
                // button, the seed-control combo).  But configure() reads back with
                // a DENSE counter — it increments its value-array pointer only for
                // serialisable widgets, so it never "sees" the null holes.
                //
                // Result: every serialize===false widget shifts all subsequent
                // values one position when read densely — canvas_width receives
                // null → NaN, canvas_height receives canvas_width's value, etc.
                //
                // onConfigure runs at the end of configure(), so we re-apply every
                // widget value using SPARSE indexing (widget[i] ← widgets_values[i]),
                // which exactly mirrors how serialize() produced the array and
                // overwrites configure()'s incorrect dense-counter assignments.
                if (info?.widgets_values && this.widgets) {
                    for (let i = 0; i < this.widgets.length; i++) {
                        const w = this.widgets[i];
                        if (w.serialize === false) continue;
                        if (i < info.widgets_values.length) w.value = info.widgets_values[i];
                    }
                }

                node._litcZoomX       = parseFloat(getW("zoom_x")?.value        ?? node._litcZoomX);
                node._litcZoomY       = parseFloat(getW("zoom_y")?.value        ?? node._litcZoomY);
                node._litcLockedRatio = parseFloat(getW("locked_ratio")?.value  ?? node._litcLockedRatio);
                node._litcColorValue  = getW("custom_color_hex")?.value         ?? node._litcColorValue;
                node._litcLocked      = getW("lock_aspect_ratio")?.value        !== false;
                syncZoomLayout();
                sync();
                if (getW("image")?.value) previewObj.loadImage(getW("image").value);
                previewObj.redraw();
            };

            // ── Cleanup on removal ────────────────────────────────────────────
            // ComfyUI doesn't always remove DOM widget elements when a node is deleted or
            // a workflow is reloaded, leaving invisible ghost overlays. Explicitly remove
            // every DOM element we own so they can't persist after the node is gone.
            const origOnRemoved = node.onRemoved;
            node.onRemoved = function () {
                origOnRemoved?.apply(this, arguments);
                [previewDomW, zoomDomW, zoomYDomW, lockedRatioDomW, lockDomW, colorDomW]
                    .forEach(w => w?.element?.remove());
            };

            // Fix 6: move "choose file to upload" button to just after the image picker (index 1).
            // ComfyUI appends it after onNodeCreated completes, so defer with rAF.
            requestAnimationFrame(() => {
                const uploadIdx = node.widgets?.findIndex(w => w.type === "button");
                if (uploadIdx > 1) {
                    const [btn] = node.widgets.splice(uploadIdx, 1);
                    node.widgets.splice(1, 0, btn);
                }
            });

            sync();
            previewObj.redraw();
        };
    },
});

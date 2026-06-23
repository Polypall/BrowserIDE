// ============================================================
// SPRITE-EDITOR.JS — Pixel art canvas editor
// ============================================================

const SpriteEditor = (() => {
    let canvas = null;
    let ctx = null;
    let isoCanvas = null;
    let isoCtx = null;

    let gridW = 16;
    let gridH = 16;
    let cellSize = 20;
    let pixels = [];           // 2D array [row][col] = color string or null
    let currentColor = '#e94560';
    let currentTool = 'pencil'; // pencil | eraser | fill
    let isDrawing = false;
    let showGrid = true;
    let isoMode = false;

    const DEFAULT_PALETTE = [
        '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00',
        '#ff00ff', '#00ffff', '#ff8800', '#8800ff', '#00ff88', '#ff0088',
        '#1e1e1e', '#333333', '#555555', '#888888', '#aaaaaa', '#dddddd',
        '#e94560', '#0f3460', '#533483', '#1a1a2e', '#16213e', '#2b2d42',
        '#ef233c', '#8d99ae', '#edf2f4', '#2d6a4f', '#40916c', '#74c69d',
    ];

    function initPixels() {
        pixels = [];
        for (let r = 0; r < gridH; r++) {
            pixels[r] = [];
            for (let c = 0; c < gridW; c++) {
                pixels[r][c] = null;
            }
        }
    }

    function init(canvasEl, isoCanvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        isoCanvas = isoCanvasEl;
        if (isoCanvas) isoCtx = isoCanvas.getContext('2d');

        initPixels();
        resize();
        render();
        bindEvents();
    }

    function resize() {
        canvas.width = gridW * cellSize;
        canvas.height = gridH * cellSize;
        canvas.style.width = (gridW * cellSize) + 'px';
        canvas.style.height = (gridH * cellSize) + 'px';

        if (isoCanvas) {
            isoCanvas.width = (gridW + gridH) * 16;
            isoCanvas.height = (gridW + gridH) * 10;
        }
    }

    function getCell(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const col = Math.floor(x / cellSize);
        const row = Math.floor(y / cellSize);
        if (row < 0 || row >= gridH || col < 0 || col >= gridW) return null;
        return { row, col };
    }

    function applyTool(row, col) {
        if (row < 0 || row >= gridH || col < 0 || col >= gridW) return;
        if (currentTool === 'pencil') {
            pixels[row][col] = currentColor;
        } else if (currentTool === 'eraser') {
            pixels[row][col] = null;
        } else if (currentTool === 'fill') {
            const targetColor = pixels[row][col];
            if (targetColor === currentColor) return;
            floodFill(row, col, targetColor, currentColor);
        }
        render();
        if (isoMode) renderIso();
    }

    function floodFill(row, col, targetColor, fillColor) {
        const stack = [[row, col]];
        const visited = new Set();

        while (stack.length > 0) {
            const [r, c] = stack.pop();
            const key = r + ',' + c;
            if (visited.has(key)) continue;
            if (r < 0 || r >= gridH || c < 0 || c >= gridW) continue;
            if (pixels[r][c] !== targetColor) continue;

            visited.add(key);
            pixels[r][c] = fillColor;

            stack.push([r-1, c], [r+1, c], [r, c-1], [r, c+1]);
        }
    }

    function bindEvents() {
        canvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            const cell = getCell(e);
            if (cell) applyTool(cell.row, cell.col);
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            const cell = getCell(e);
            if (cell) applyTool(cell.row, cell.col);
        });

        canvas.addEventListener('mouseup', () => { isDrawing = false; });
        canvas.addEventListener('mouseleave', () => { isDrawing = false; });

        // Touch support
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDrawing = true;
            const cell = getCell(e.touches[0]);
            if (cell) applyTool(cell.row, cell.col);
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!isDrawing) return;
            const cell = getCell(e.touches[0]);
            if (cell) applyTool(cell.row, cell.col);
        }, { passive: false });

        canvas.addEventListener('touchend', () => { isDrawing = false; });
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Checkerboard background
        for (let r = 0; r < gridH; r++) {
            for (let c = 0; c < gridW; c++) {
                const isLight = (r + c) % 2 === 0;
                ctx.fillStyle = isLight ? '#444' : '#333';
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            }
        }

        // Pixels
        for (let r = 0; r < gridH; r++) {
            for (let c = 0; c < gridW; c++) {
                if (pixels[r][c]) {
                    ctx.fillStyle = pixels[r][c];
                    ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                }
            }
        }

        // Grid lines
        if (showGrid) {
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 0.5;
            for (let r = 0; r <= gridH; r++) {
                ctx.beginPath();
                ctx.moveTo(0, r * cellSize);
                ctx.lineTo(gridW * cellSize, r * cellSize);
                ctx.stroke();
            }
            for (let c = 0; c <= gridW; c++) {
                ctx.beginPath();
                ctx.moveTo(c * cellSize, 0);
                ctx.lineTo(c * cellSize, gridH * cellSize);
                ctx.stroke();
            }
        }
    }

    function renderIso() {
        if (!isoCtx) return;
        isoCtx.clearRect(0, 0, isoCanvas.width, isoCanvas.height);

        const tileW = 32;
        const tileH = 16;
        const tileDepth = 12;
        const offsetX = isoCanvas.width / 2;
        const offsetY = 20;

        for (let r = 0; r < gridH; r++) {
            for (let c = 0; c < gridW; c++) {
                const color = pixels[r][c];
                if (!color) continue;

                const isoX = (c - r) * (tileW / 2) + offsetX;
                const isoY = (c + r) * (tileH / 2) + offsetY;

                // Top face
                isoCtx.fillStyle = color;
                isoCtx.beginPath();
                isoCtx.moveTo(isoX, isoY);
                isoCtx.lineTo(isoX + tileW/2, isoY + tileH/2);
                isoCtx.lineTo(isoX, isoY + tileH);
                isoCtx.lineTo(isoX - tileW/2, isoY + tileH/2);
                isoCtx.closePath();
                isoCtx.fill();

                // Right face (darker)
                isoCtx.fillStyle = darkenColor(color, 0.6);
                isoCtx.beginPath();
                isoCtx.moveTo(isoX + tileW/2, isoY + tileH/2);
                isoCtx.lineTo(isoX + tileW/2, isoY + tileH/2 + tileDepth);
                isoCtx.lineTo(isoX, isoY + tileH + tileDepth);
                isoCtx.lineTo(isoX, isoY + tileH);
                isoCtx.closePath();
                isoCtx.fill();

                // Left face (darker still)
                isoCtx.fillStyle = darkenColor(color, 0.4);
                isoCtx.beginPath();
                isoCtx.moveTo(isoX, isoY + tileH);
                isoCtx.lineTo(isoX, isoY + tileH + tileDepth);
                isoCtx.lineTo(isoX - tileW/2, isoY + tileH/2 + tileDepth);
                isoCtx.lineTo(isoX - tileW/2, isoY + tileH/2);
                isoCtx.closePath();
                isoCtx.fill();
            }
        }
    }

    function darkenColor(hex, factor) {
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        return `rgb(${Math.floor(r*factor)},${Math.floor(g*factor)},${Math.floor(b*factor)})`;
    }

    function setTool(tool) { currentTool = tool; }
    function setColor(color) { currentColor = color; }
    function toggleGrid() { showGrid = !showGrid; render(); }

    function setGridSize(w, h) {
        const oldPixels = pixels;
        const oldW = gridW;
        const oldH = gridH;
        gridW = w;
        gridH = h;
        initPixels();
        // Copy old pixels
        for (let r = 0; r < Math.min(oldH, gridH); r++) {
            for (let c = 0; c < Math.min(oldW, gridW); c++) {
                pixels[r][c] = oldPixels[r][c];
            }
        }
        resize();
        render();
    }

    function setCellSize(size) {
        cellSize = size;
        resize();
        render();
    }

    function clearCanvas() {
        initPixels();
        render();
        if (isoMode && isoCtx) isoCtx.clearRect(0, 0, isoCanvas.width, isoCanvas.height);
    }

    function exportPNG() {
        // Export clean version without grid
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = gridW;
        exportCanvas.height = gridH;
        const ectx = exportCanvas.getContext('2d');

        for (let r = 0; r < gridH; r++) {
            for (let c = 0; c < gridW; c++) {
                if (pixels[r][c]) {
                    ectx.fillStyle = pixels[r][c];
                    ectx.fillRect(c, r, 1, 1);
                }
            }
        }
        return exportCanvas.toDataURL('image/png');
    }

    function exportScaledPNG(scale = 4) {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = gridW * scale;
        exportCanvas.height = gridH * scale;
        const ectx = exportCanvas.getContext('2d');
        ectx.imageSmoothingEnabled = false;

        for (let r = 0; r < gridH; r++) {
            for (let c = 0; c < gridW; c++) {
                if (pixels[r][c]) {
                    ectx.fillStyle = pixels[r][c];
                    ectx.fillRect(c * scale, r * scale, scale, scale);
                }
            }
        }
        return exportCanvas.toDataURL('image/png');
    }

    function toggleIso(enabled) {
        isoMode = enabled;
        if (enabled) renderIso();
    }

    function loadFromDataUrl(dataUrl) {
        const img = new Image();
        img.onload = () => {
            // Resize grid to match image
            gridW = img.width;
            gridH = img.height;
            initPixels();

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = gridW;
            tempCanvas.height = gridH;
            const tctx = tempCanvas.getContext('2d');
            tctx.drawImage(img, 0, 0);

            const imageData = tctx.getImageData(0, 0, gridW, gridH);
            for (let r = 0; r < gridH; r++) {
                for (let c = 0; c < gridW; c++) {
                    const idx = (r * gridW + c) * 4;
                    const ra = imageData.data[idx];
                    const g = imageData.data[idx+1];
                    const b = imageData.data[idx+2];
                    const a = imageData.data[idx+3];
                    if (a > 0) {
                        pixels[r][c] = `rgba(${ra},${g},${b},${(a/255).toFixed(2)})`;
                    }
                }
            }

            resize();
            render();
        };
        img.src = dataUrl;
    }

    function executeDrawCode(code) {
        // Execute AI-generated canvas drawing code
        try {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = gridW;
            tempCanvas.height = gridH;
            const tctx = tempCanvas.getContext('2d');
            const fn = new Function('canvas', 'ctx', 'width', 'height', code);
            fn(tempCanvas, tctx, gridW, gridH);
            loadFromDataUrl(tempCanvas.toDataURL());
        } catch (e) {
            console.error('Draw code error:', e.message);
        }
    }

    function getPixels() { return pixels; }
    function getGridSize() { return { w: gridW, h: gridH }; }
    function getPalette() { return DEFAULT_PALETTE; }

    return {
        init, render, renderIso,
        setTool, setColor, toggleGrid, setCellSize,
        setGridSize, clearCanvas, toggleIso,
        exportPNG, exportScaledPNG,
        loadFromDataUrl, executeDrawCode,
        getPixels, getGridSize, getPalette,
    };
})();

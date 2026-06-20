'use strict';
document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // 1. State
    // =========================================================
    let originalImage = null;
    let uploadedImageSource = null; // アップロードされた無加工の元画像を保持 (v7)
    let originalFileName = '1stamp-free';

    // ペイントエディタのステート変数 (TDZバグ回避のため先頭に定義) (v6)
    let paintGridSize = 18;
    let currentPaintColor = '#ffffff';
    let currentPaintTool = 'pencil'; // 'pencil' | 'eraser' | 'bucket'
    let isPainting = false;
    let paintGrid = []; // Grid pixels [y][x] as color hex or null
    let paintHistory = []; // ピクセルアートのアンドゥ履歴スタック (v7.5)
    let paintCompositeCanvas = null; // ピクセルアート合成用の永続的なCanvas (v7.5)
    let currentInputMode = 'upload'; // 'upload' | 'paint'


    const state = {
        // Neon
        useNeon: true,                // ネオン効果を適用するかどうか
        colorMode: 'single',          // 'single' | 'gradient'
        neonColor: '#ff3366',
        gradColor1: '#ff007f',
        gradColor2: '#00f0ff',
        gradType: 'linear',           // 'linear' | 'radial'
        glowBlur: 8,
        glowIntensity: 3,
        // Background preset (ネオン背景)
        useBgPreset: false,           // true = 有効, false = 無効
        bgPresetColor: null,          // 背景ネオンのメインカラー
        bgPresetColor2: null,         // グラデーション2色目 (高額バッジ用)

        // Image translation (v6)
        imgScale: 0.9,                // 画像の縮小率 (初期値 90%)
        imgX: 0,                      // 画像の位置 X (左右オフセット)
        imgY: 0,                      // 画像の位置 Y (上下オフセット)

        // Shadow
        shadowOpacity: 0.4,
        shadowBlur: 4,
        shadowOffsetX: 0,
        shadowOffsetY: 2,

        decorType: 'none',
        decorDepth: 'front',
        decorScale: 0.4,
        decorX: 0,
        decorY: -35,
        decorRotate: 0,
        decorColorMode: 'sync',       // 'sync'|'single'|'gradient'|'metallic'
        decorColor: '#ffffff',
        decorGrad1: '#ffe066',
        decorGrad2: '#f5af19',
        decorGradType: 'linear',
        decorMetal: 'gold',
    };

    // =========================================================
    // 2. Bits preset definitions
    // =========================================================
    const BITS_PRESETS = {
        // ---- 通常バッジ: bgColor = 背景ネオン単色 ----
        'bits-1':      { bgColor: '#888888', label: '1 Bit (グレー)' },
        'bits-100':    { bgColor: '#8F54F2', label: '100 Bit (パープル)' },
        'bits-1000':   { bgColor: '#009473', label: '1,000 Bit (ティール)' },
        'bits-5000':   { bgColor: '#006AB3', label: '5,000 Bit (ブルー)' },
        'bits-10000':  { bgColor: '#E92323', label: '10,000 Bit (レッド)' },
        'bits-25000':  { bgColor: '#E0428D', label: '25,000 Bit (ピンク)' },
        'bits-50000':  { bgColor: '#D47500', label: '50,000 Bit (オレンジ)' },
        'bits-75000':  { bgColor: '#00B22A', label: '75,000 Bit (グリーン)' },
        'bits-100000': { bgColor: '#FFB300', label: '100,000 Bit (イエロー)' },
        // ---- 高額バッジ: bgColor=アクセント, bgColor2=深紫 でグラデ背景 ----
        'bits-200000':  { bgColor: '#A1A1A1', bgColor2: '#3E3260', label: '200,000 Bit (グレー系)' },
        'bits-300000':  { bgColor: '#D67AFF', bgColor2: '#3E3260', label: '300,000 Bit (パープル)' },
        'bits-400000':  { bgColor: '#00D1A1', bgColor2: '#3E3260', label: '400,000 Bit (ティール)' },
        'bits-500000':  { bgColor: '#36A7FF', bgColor2: '#3E3260', label: '500,000 Bit (ブルー)' },
        'bits-600000':  { bgColor: '#FF3B3B', bgColor2: '#3E3260', label: '600,000 Bit (レッド)' },
        'bits-700000':  { bgColor: '#FF5C9D', bgColor2: '#3E3260', label: '700,000 Bit (ピンク)' },
        'bits-800000':  { bgColor: '#FF8A00', bgColor2: '#3E3260', label: '800,000 Bit (オレンジ)' },
        'bits-900000':  { bgColor: '#26FF58', bgColor2: '#3E3260', label: '900,000 Bit (グリーン)' },
        'bits-1000000': { bgColor: '#FFD93B', bgColor2: '#3E3260', label: '1,000,000 Bit (ゴールド)' },
    };

    // =========================================================
    // 3. DOM refs
    // =========================================================
    const dropZone     = document.getElementById('drop-zone');
    const fileInput    = document.getElementById('file-input');
    const fileInfo     = document.getElementById('file-info');
    const fileNameSpan = document.getElementById('file-name');
    const bgPresetToggle = document.getElementById('bg-preset-toggle');
    const bgPresetVal = document.getElementById('bg-preset-val');
    const removeBtn    = document.getElementById('remove-file-btn');
    const downloadBtn  = document.getElementById('download-btn');
    const downloadChannelPointsBtn = document.getElementById('download-channel-points-btn');

    // Neon effect toggle (v4)
    const neonEffectToggle = document.getElementById('neon-effect-toggle');
    const neonEffectVal = document.getElementById('neon-effect-val');
    const neonControlsWrapper = document.getElementById('neon-controls-wrapper');

    // Input mode tabs (v4/v7)
    const tabUploadBtn = document.getElementById('tab-upload-btn');
    const tabPaintBtn  = document.getElementById('tab-paint-btn');
    const tabGraffitiBtn = document.getElementById('tab-graffiti-btn');
    const panelUpload  = document.getElementById('panel-upload');
    const panelPaint   = document.getElementById('panel-paint');
    const panelGraffiti = document.getElementById('panel-graffiti');

    const paintCanvas  = document.getElementById('paint-canvas');
    const paintCustomColor = document.getElementById('paint-custom-color');
    const toolPaintUndo = document.getElementById('tool-paint-undo'); // アンドゥボタン (v7.5)



    // Image translation DOM refs (v6)
    const imgScaleInput  = document.getElementById('img-scale');
    const imgScaleVal    = document.getElementById('img-scale-val');
    const imgXInput      = document.getElementById('img-x');
    const imgXVal        = document.getElementById('img-x-val');
    const imgYInput      = document.getElementById('img-y');
    const imgYVal        = document.getElementById('img-y-val');

    const canvases = {
        72: document.getElementById('canvas-72'),
        36: document.getElementById('canvas-36'),
        18: document.getElementById('canvas-18'),
    };

    // Neon controls
    const colorModeRadios = document.querySelectorAll('input[name="color-mode"]');
    const singleColorPanel   = document.getElementById('single-color-panel');
    const gradientColorPanel = document.getElementById('gradient-color-panel');
    const colorBtns   = document.querySelectorAll('.color-btn:not(.custom-trigger)');
    const customColorInput = document.getElementById('custom-color');
    const gradColor1Input  = document.getElementById('grad-color1');
    const gradColor2Input  = document.getElementById('grad-color2');
    const gradColor1Text   = document.getElementById('grad-color1-text');
    const gradColor2Text   = document.getElementById('grad-color2-text');
    const gradTypeRadios   = document.querySelectorAll('input[name="grad-type"]');
    const glowBlurInput    = document.getElementById('glow-blur');
    const glowBlurVal      = document.getElementById('glow-blur-val');
    const glowIntInput     = document.getElementById('glow-intensity');
    const glowIntVal       = document.getElementById('glow-intensity-val');

    // Shadow controls
    const shadowOpacityInput   = document.getElementById('shadow-opacity');
    const shadowOpacityVal     = document.getElementById('shadow-opacity-val');
    const shadowBlurInput      = document.getElementById('shadow-blur');
    const shadowBlurVal        = document.getElementById('shadow-blur-val');
    const shadowOffsetXInput   = document.getElementById('shadow-offset-x');
    const shadowOffsetXVal     = document.getElementById('shadow-offset-x-val');
    const shadowOffsetYInput   = document.getElementById('shadow-offset-y');
    const shadowOffsetYVal     = document.getElementById('shadow-offset-y-val');




    // Decoration controls
    const decorBtns       = document.querySelectorAll('.decor-btn');
    const decorControls   = document.getElementById('decor-controls');
    const decorDepthRadios = document.querySelectorAll('input[name="decor-depth"]');
    const decorScaleInput = document.getElementById('decor-scale');
    const decorScaleVal   = document.getElementById('decor-scale-val');
    const decorXInput     = document.getElementById('decor-x');
    const decorXVal       = document.getElementById('decor-x-val');
    const decorYInput     = document.getElementById('decor-y');
    const decorYVal       = document.getElementById('decor-y-val');
    const decorRotateInput = document.getElementById('decor-rotate');
    const decorRotateVal  = document.getElementById('decor-rotate-val');
    const decorColorModeRadios = document.querySelectorAll('input[name="decor-color-mode"]');
    const decorSinglePanel    = document.getElementById('decor-single-color-panel');
    const decorGradPanel      = document.getElementById('decor-gradient-color-panel');
    const decorMetallicPanel  = document.getElementById('decor-metallic-panel');
    const decorColorInput     = document.getElementById('decor-color');
    const decorColorText      = document.getElementById('decor-color-text');
    const decorGrad1Input     = document.getElementById('decor-grad1');
    const decorGrad2Input     = document.getElementById('decor-grad2');
    const decorGrad1Text      = document.getElementById('decor-grad1-text');
    const decorGrad2Text      = document.getElementById('decor-grad2-text');
    const decorGradTypeRadios = document.querySelectorAll('input[name="decor-grad-type"]');
    const metalBtns           = document.querySelectorAll('.metal-btn');

    // Preview BG toggle
    const bgToggleBtns = document.querySelectorAll('.bg-toggle-btn');
    const bgWrappers   = document.querySelectorAll('.badge-canvas-wrapper, .actual-badge-box');

    // Chat
    const chatTabBtns  = document.querySelectorAll('.chat-tab-btn');
    const chatBox      = document.getElementById('chat-simulation-area');

    // Actual size
    const actual18Dest  = document.getElementById('actual-18-dest');
    const chatBadgeDest1 = document.getElementById('chat-badge-dest-1');
    const chatBadgeDest2 = document.getElementById('chat-badge-dest-2');

    // Accordions
    const accordions = {
        presets:   document.getElementById('acc-presets'),
        deco:      document.getElementById('acc-decorations'),
        neon:      document.getElementById('acc-neon'),
        shadow:    document.getElementById('acc-shadow'),
        filters:   document.getElementById('acc-filters'),
    };

    // =========================================================
    // 4. Slider helper – update CSS gradient fill
    // =========================================================
    function syncSliderFill(input) {
        if (!input) return; // ヌル安全対策 (v6)
        const min = parseFloat(input.min) || 0;
        const max = parseFloat(input.max) || 100;
        const val = parseFloat(input.value);
        const pct = ((val - min) / (max - min)) * 100;
        input.style.setProperty('--pct', pct + '%');
    }

    function setupSlider(input, displayEl, suffix, stateProp, transform) {
        if (!input || !displayEl) return; // ヌル安全対策 (v6)
        syncSliderFill(input);
        // 初期値をstateに反映（ページロード時からrenderBadgeが使用できるよう）
        const initRaw = parseFloat(input.value);
        state[stateProp] = transform ? transform(initRaw) : initRaw;
        displayEl.textContent = initRaw + suffix;
        input.addEventListener('input', () => {
            const raw = parseFloat(input.value);
            const val = transform ? transform(raw) : raw;
            state[stateProp] = val;
            displayEl.textContent = raw + suffix;
            syncSliderFill(input);
            renderAll();
        });
    }
    // =========================================================
    // 5. Unlock accordions after image load
    // =========================================================
    function enableAccordions() {
        Object.values(accordions).forEach(el => {
            el.classList.remove('disabled-accordion');
            el.classList.add('enabled');
        });
        downloadBtn.classList.remove('btn-disabled');
        downloadBtn.disabled = false;
        
        if (downloadChannelPointsBtn) {
            downloadChannelPointsBtn.classList.remove('btn-disabled');
            downloadChannelPointsBtn.disabled = false;
        }
    }

    // =========================================================
    // 6. File upload
    // =========================================================
    dropZone.addEventListener('click', (e) => {
        if (e.target.id === 'remove-file-btn' || e.target.closest('#remove-file-btn')) return;
        if (e.target === fileInput) return; // 自己ループ防止
        fileInput.click();
    });
    if (fileInput) {
        fileInput.addEventListener('click', (e) => {
            e.stopPropagation(); // 親へのイベントバブリングを防止してクリック無限ループを防ぐ
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files[0]) loadFile(fileInput.files[0]);
        });
    }
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        originalImage = null;
        originalFileName = '1stamp-free';
        fileInfo.classList.add('id-hidden');
        fileInput.value = '';
        clearCanvases();
    });

    // 画像を現在のグリッド解像度でドット絵キャンバスにインポートする関数 (v5/v6)
    function importImageToPaintGrid(img) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = paintGridSize;
        tempCanvas.height = paintGridSize;
        const tCtx = tempCanvas.getContext('2d');
        
        // 補間（アンチエイリアス）を無効化してドットのクッキリ感を保つ
        tCtx.imageSmoothingEnabled = false;
        tCtx.mozImageSmoothingEnabled = false;
        tCtx.webkitImageSmoothingEnabled = false;
        tCtx.msImageSmoothingEnabled = false;

        tCtx.clearRect(0, 0, paintGridSize, paintGridSize);
        const size = paintGridSize;
        
        // 元画像の縮小率と位置X, Yをペイントグリッド用にスケール換算
        const scale = typeof state.imgScale === 'number' ? state.imgScale : 0.9;
        const w = size * scale;
        const h = size * scale;
        const gridFactor = paintGridSize / 72; // imgX, Y は 72px 基準のオフセット
        const x = (size - w) / 2 + (typeof state.imgX === 'number' ? state.imgX : 0) * gridFactor;
        const y = (size - h) / 2 + (typeof state.imgY === 'number' ? state.imgY : 0) * gridFactor;
        
        tCtx.drawImage(img, x, y, w, h);
        
        // ピクセル情報の取得と色抽出
        const imgData = tCtx.getImageData(0, 0, size, size);
        const data = imgData.data;
        
        paintGrid = [];
        for (let cy = 0; cy < size; cy++) {
            const row = [];
            for (let cx = 0; cx < size; cx++) {
                const idx = (cy * size + cx) * 4;
                const r = data[idx];
                const g = data[idx+1];
                const b = data[idx+2];
                const a = data[idx+3];
                
                if (a < 15) { // ほぼ透明な部分は透明 (null) として初期化
                    row.push(null);
                } else {
                    // RGB値をHEXカラーに変換
                    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                    row.push(hex);
                }
            }
            paintGrid.push(row);
        }
        
        // インポート直後に履歴を初期化し、この初期モザイク画像を最古の履歴とする (v7.5)
        paintHistory = [JSON.parse(JSON.stringify(paintGrid))];
        updateUndoButtonState();
        
        drawPaintGrid();
    }

    function loadFile(file) {
        if (!file.type.startsWith('image/')) return;
        originalFileName = file.name.replace(/\.[^/.]+$/, '');
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            uploadedImageSource = img; // 無加工の元画像を保持 (v7)
            originalImage = img;
            URL.revokeObjectURL(url);
            fileNameSpan.textContent = file.name;
            fileInfo.classList.remove('id-hidden');
            
            // アップロード時、元画像を劣化させないよう自動で72x72グリッドに設定 (v7.5)
            const radio72 = document.querySelector('input[name="paint-grid-size"][value="72"]');
            if (radio72) radio72.checked = true;
            paintGridSize = 72;

            // ペイントエディタに画像を自動インポート (v5)
            importImageToPaintGrid(img);
            
            enableAccordions();
            
            // 現在のモードに合わせて描画 (v7)
            if (currentInputMode === 'paint') {
                applyPaintToBadge();
            } else {
                renderAll();
            }
        };
        img.src = url;
    }

    function clearCanvases() {
        [72, 36, 18].forEach(size => {
            const ctx = canvases[size].getContext('2d');
            ctx.clearRect(0, 0, size, size);
        });
        actual18Dest.innerHTML = '';
        chatBadgeDest1.innerHTML = '';
        chatBadgeDest2.innerHTML = '';

        downloadBtn.classList.add('btn-disabled');
        downloadBtn.disabled = true;
        if (downloadChannelPointsBtn) {
            downloadChannelPointsBtn.classList.add('btn-disabled');
            downloadChannelPointsBtn.disabled = true;
        }
    }

    // =========================================================
    // 7. Glow color builder
    // =========================================================
    /**
     * Returns a function: (ctx, size) => gradient or solid color string
     * for the shadow/glow drawing phase.
     */
    function buildGlowColor(ctx, size) {
        if (state.colorMode === 'single') {
            return state.neonColor;
        }
        // gradient
        let grad;
        if (state.gradType === 'radial') {
            grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        } else {
            grad = ctx.createLinearGradient(0, 0, size, size);
        }
        grad.addColorStop(0, state.gradColor1);
        grad.addColorStop(1, state.gradColor2);
        return grad;
    }

    // =========================================================
    // 8. Decoration shape drawing (72-unit canvas coords)
    // =========================================================

    /**
     * Draws a decoration icon onto `ctx` at (cx, cy) with given size.
     * Uses CSS emoji / SVG path approach via text for icons.
     */
    function drawDecoShape(ctx, decorType, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((state.decorRotate * Math.PI) / 180);

        switch (decorType) {
            case 'crown':    drawCrown(ctx, size); break;
            case 'star':     drawStar(ctx, size, 5); break;
            case 'fire':     drawFire(ctx, size); break;
            case 'heart':    drawHeart(ctx, size); break;
            case 'diamond':  drawDiamond(ctx, size); break;
            case 'shield':   drawShield(ctx, size); break;
            case 'triangle': drawPolygon(ctx, size, 3); break;
            case 'rhombus':  drawPolygon(ctx, size, 4); break;
            case 'pentagon': drawPolygon(ctx, size, 5); break;
            case 'hexagon':  drawPolygon(ctx, size, 6); break;
            case 'star8':    drawStar(ctx, size, 8); break;
            case 'wings':    drawWings(ctx, size); break;
            default: break;
        }
        ctx.restore();
    }

    function drawCrown(ctx, s) {
        const h = s * 0.7; const w = s;
        ctx.beginPath();
        ctx.moveTo(-w/2, h/2);
        ctx.lineTo(-w/2, -h/4);
        ctx.lineTo(-w/4, h/6);
        ctx.lineTo(0, -h/2);
        ctx.lineTo(w/4, h/6);
        ctx.lineTo(w/2, -h/4);
        ctx.lineTo(w/2, h/2);
        ctx.closePath();
    }
    function drawStar(ctx, s, points) {
        const outer = s / 2;
        const inner = outer * 0.45;
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outer : inner;
            const a = (i * Math.PI) / points - Math.PI / 2;
            i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        }
        ctx.closePath();
    }
    function drawFire(ctx, s) {
        const r = s / 2;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.bezierCurveTo(r * 0.5, -r * 0.3, r, r * 0.2, r * 0.3, r * 0.6);
        ctx.bezierCurveTo(r * 0.5, r * 0.1, 0, r * 0.5, -r * 0.1, r);
        ctx.bezierCurveTo(-r * 0.5, r * 0.5, -r * 0.6, r * 0.1, -r * 0.3, r * 0.6);
        ctx.bezierCurveTo(-r, r * 0.2, -r * 0.5, -r * 0.3, 0, -r);
        ctx.closePath();
    }
    function drawHeart(ctx, s) {
        const r = s * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, r * 0.35);
        ctx.bezierCurveTo(-r * 0.1, 0, -r, 0, -r, -r * 0.4);
        ctx.bezierCurveTo(-r, -r, 0, -r * 0.9, 0, -r * 0.2);
        ctx.bezierCurveTo(0, -r * 0.9, r, -r, r, -r * 0.4);
        ctx.bezierCurveTo(r, 0, r * 0.1, 0, 0, r * 0.35);
        ctx.closePath();
    }
    function drawDiamond(ctx, s) {
        const h = s / 2; const w = h * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, -h); ctx.lineTo(w, 0);
        ctx.lineTo(0, h);  ctx.lineTo(-w, 0);
        ctx.closePath();
    }
    function drawShield(ctx, s) {
        const h = s / 2; const w = h * 0.8;
        ctx.beginPath();
        ctx.moveTo(-w, -h);
        ctx.lineTo(w, -h);
        ctx.lineTo(w, h * 0.1);
        ctx.quadraticCurveTo(0, h, 0, h);
        ctx.quadraticCurveTo(0, h, -w, h * 0.1);
        ctx.closePath();
    }
    function drawPolygon(ctx, s, sides) {
        const r = s / 2;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const a = (i * 2 * Math.PI) / sides - Math.PI / 2;
            i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        }
        ctx.closePath();
    }
    function drawWings(ctx, s) {
        const r = s / 2;
        // left wing
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-r*0.3, -r*0.5, -r, -r*0.8, -r, -r*0.2);
        ctx.bezierCurveTo(-r*0.6, r*0.3, -r*0.2, r*0.2, 0, r*0.1);
        // right wing
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(r*0.3, -r*0.5, r, -r*0.8, r, -r*0.2);
        ctx.bezierCurveTo(r*0.6, r*0.3, r*0.2, r*0.2, 0, r*0.1);
        ctx.closePath();
    }

    // Build fill style for decoration
    function buildDecorFill(ctx, size) {
        const mode = state.decorColorMode;
        if (mode === 'sync') {
            return buildGlowColor(ctx, size);
        }
        if (mode === 'single') {
            return state.decorColor;
        }
        if (mode === 'metallic') {
            const metalColors = {
                gold:   ['#fff7aa', '#ffd700', '#b8860b', '#ffd700', '#fff7aa'],
                silver: ['#ffffff', '#e0e0e0', '#a0a0a0', '#e0e0e0', '#ffffff'],
                bronze: ['#f5c990', '#cd7f32', '#7a4100', '#cd7f32', '#f5c990'],
            };
            const stops = metalColors[state.decorMetal] || metalColors.gold;
            const grad = ctx.createLinearGradient(-size/2, -size/2, size/2, size/2);
            stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
            return grad;
        }
        // gradient
        let grad;
        if (state.decorGradType === 'radial') {
            grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
        } else {
            grad = ctx.createLinearGradient(-size/2, -size/2, size/2, size/2);
        }
        grad.addColorStop(0, state.decorGrad1);
        grad.addColorStop(1, state.decorGrad2);
        return grad;
    }

    // =========================================================
    // 9. 背景ネオングロー レンダラー
    // =========================================================
    /**
     * バッジ画像の背後に、Bitsプリセットカラーのソフトなネオン発光を描画する。
     * destination-over合成で既存描画の最背面に配置する。
     */
    function renderBackground(ctx, size) {
        function hexToRgba(hex, alpha) {
            const h = hex.replace('#', '');
            const r = parseInt(h.substr(0, 2), 16);
            const g = parseInt(h.substr(2, 2), 16);
            const b = parseInt(h.substr(4, 2), 16);
            return `rgba(${r},${g},${b},${alpha})`;
        }

        const cx = size / 2, cy = size / 2;
        const radius = size * 0.75;

        // グラデーションキャンバスを作成
        const gradCanvas = document.createElement('canvas');
        gradCanvas.width = size; gradCanvas.height = size;
        const gCtx = gradCanvas.getContext('2d');

        let grad;
        if (state.bgPresetColor2) {
            // 高額バッジ: アクセントカラー中心 → 深紫フェードアウト
            grad = gCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            grad.addColorStop(0,    hexToRgba(state.bgPresetColor, 0.82));
            grad.addColorStop(0.35, hexToRgba(state.bgPresetColor, 0.58));
            grad.addColorStop(0.62, hexToRgba(state.bgPresetColor2, 0.30));
            grad.addColorStop(1,    hexToRgba(state.bgPresetColor2, 0));
        } else {
            // 通常バッジ: 単色ラジアルグロー
            grad = gCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            grad.addColorStop(0,    hexToRgba(state.bgPresetColor, 0.78));
            grad.addColorStop(0.42, hexToRgba(state.bgPresetColor, 0.44));
            grad.addColorStop(1,    hexToRgba(state.bgPresetColor, 0));
        }
        gCtx.fillStyle = grad;
        gCtx.fillRect(0, 0, size, size);

        // ブラーを掛けてソフトなグロー効果を生成
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = size; blurCanvas.height = size;
        const bCtx = blurCanvas.getContext('2d');
        bCtx.filter = `blur(${Math.max(2, Math.round(size * 0.11))}px)`;
        bCtx.drawImage(gradCanvas, 0, 0);

        // destination-over で既存描画の最背面に合成
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(blurCanvas, 0, 0);
        ctx.restore();
    }

    // =========================================================
    // 10. Main render
    // =========================================================
    function renderAll() {
        if (!originalImage) return;
        [72, 36, 18].forEach(size => renderBadge(size));
        update18pxMirrors();
    }

    function renderBadge(size) {
        const canvas = canvases[size];
        renderBadgeToCanvas(canvas, size);
    }

    function renderBadgeToCanvas(canvas, size) {
        if (!canvas) return;
        const ctx    = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);

        // 補間（アンチエイリアス）を無効化してドット絵をクッキリ描画する (v6)
        ctx.imageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;

        const scale  = typeof state.imgScale === 'number' ? state.imgScale : 0.9;
        const drawW  = size * scale;
        const drawH  = size * scale;
        
        // Scale factors for decoration & image offset (relative to 72px canvas)
        const scaleFactor = size / 72;
        
        // 画像自体の大きさ・位置X, Y調整オフセット (v6)
        const offX   = (size - drawW) / 2 + (typeof state.imgX === 'number' ? state.imgX : 0) * scaleFactor;
        const offY   = (size - drawH) / 2 + (typeof state.imgY === 'number' ? state.imgY : 0) * scaleFactor;

        // ---- Drop shadow pass (draw behind everything) ----
        if (state.shadowOpacity > 0 && originalImage) {
            // Offscreen to composite shadow
            const tmpShadow = document.createElement('canvas');
            tmpShadow.width = size; tmpShadow.height = size;
            const sCtx = tmpShadow.getContext('2d');
            sCtx.imageSmoothingEnabled = false;
            sCtx.save();
            sCtx.shadowColor   = `rgba(0,0,0,${state.shadowOpacity})`;
            sCtx.shadowBlur    = state.shadowBlur * scaleFactor * 3;
            sCtx.shadowOffsetX = state.shadowOffsetX * scaleFactor;
            sCtx.shadowOffsetY = state.shadowOffsetY * scaleFactor;
            sCtx.drawImage(originalImage, offX, offY, drawW, drawH);
            sCtx.restore();
            ctx.drawImage(tmpShadow, 0, 0);
        }

        // ---- Decoration (back layer) ----
        if (state.decorType !== 'none' && state.decorDepth === 'back') {
            drawDecoration(ctx, size, scaleFactor);
        }

        // ---- Neon Glow / Outline rim (DRAW BEHIND THE IMAGE) ----
        if (state.useNeon && originalImage) {
            const tmp = document.createElement('canvas');
            tmp.width = size; tmp.height = size;
            const tCtx = tmp.getContext('2d');
            tCtx.imageSmoothingEnabled = false;

            // Draw base image on tmp
            tCtx.drawImage(originalImage, offX, offY, drawW, drawH);

            const glowColor = buildGlowColor(tCtx, size);

            tCtx.globalCompositeOperation = 'source-in';
            tCtx.fillStyle = glowColor;
            tCtx.fillRect(0, 0, size, size);
            tCtx.globalCompositeOperation = 'source-over';

            const blur = state.glowBlur * scaleFactor;

            // 1. Neon outline rim (Draw behind the image, slightly blurred for outline border glow)
            ctx.save();
            ctx.filter = `blur(${Math.max(0.5, blur * 0.25)}px)`;
            ctx.globalAlpha = 0.85; // Stronger outline since it's behind the image
            ctx.drawImage(tmp, 0, 0);
            ctx.restore();

            // 2. Neon Glow layers (Draw behind the image for soft neon ambient aura)
            const iterations = state.glowIntensity;
            for (let i = 0; i < iterations; i++) {
                ctx.save();
                ctx.filter = `blur(${blur}px)`;
                ctx.globalAlpha = 0.75 / iterations;
                ctx.drawImage(tmp, 0, 0);
                ctx.restore();
            }
        }

        // ---- Draw base image (ON TOP of neon glow) ----
        if (originalImage) {
            ctx.drawImage(originalImage, offX, offY, drawW, drawH);
        }

        // ---- Decoration (front layer) ----
        if (state.decorType !== 'none' && state.decorDepth === 'front') {
            drawDecoration(ctx, size, scaleFactor);
        }

        // ---- 背景ネオングロー (destination-overで最背面に) ----
        if (state.useNeon && state.useBgPreset && state.bgPresetColor) {
            renderBackground(ctx, size);
        }
    }

    function drawDecoration(ctx, size, scaleFactor) {
        const decorSize  = size * state.decorScale;
        const cx = size / 2 + state.decorX * scaleFactor;
        const cy = size / 2 + state.decorY * scaleFactor;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((state.decorRotate * Math.PI) / 180);

        // Temporarily reset transform for shape path, then fill
        ctx.translate(-cx, -cy); // undo to absolute coords
        ctx.translate(cx, cy);   // restore
        ctx.translate(-cx, -cy);

        // Reset and just draw normally
        ctx.restore();
        ctx.save();

        // Actually we need to draw the shape in local (cx,cy) space
        // Create a temp canvas for the decoration
        const tmpD = document.createElement('canvas');
        tmpD.width = size; tmpD.height = size;
        const dCtx = tmpD.getContext('2d');

        dCtx.save();
        dCtx.translate(cx, cy);
        dCtx.rotate((state.decorRotate * Math.PI) / 180);

        drawDecoShape(dCtx, state.decorType, 0, 0, decorSize);

        // fill style
        dCtx.fillStyle = buildDecorFill(dCtx, decorSize);
        dCtx.fill();

        // Subtle outline
        dCtx.strokeStyle = 'rgba(255,255,255,0.35)';
        dCtx.lineWidth = Math.max(0.5, 1 * scaleFactor);
        dCtx.stroke();

        dCtx.restore();

        // Glow for decor
        ctx.save();
        ctx.filter = `blur(${3 * scaleFactor}px)`;
        ctx.globalAlpha = 0.7;
        ctx.drawImage(tmpD, 0, 0);
        ctx.restore();

        ctx.drawImage(tmpD, 0, 0);
        ctx.restore();
    }


    // =========================================================
    // 10. Update 18px mirrors
    // =========================================================
    function update18pxMirrors() {
        const canvas18 = canvases[18];
        const dataUrl = canvas18.toDataURL('image/png');

        function makeImg() {
            const img = new Image();
            img.src = dataUrl;
            img.width = 18; img.height = 18;
            return img;
        }

        actual18Dest.innerHTML  = '';
        actual18Dest.appendChild(makeImg());
        chatBadgeDest1.innerHTML = '';
        chatBadgeDest1.appendChild(makeImg());
        chatBadgeDest2.innerHTML = '';
        chatBadgeDest2.appendChild(makeImg());
    }

    // =========================================================
    // 11. Wire up controls
    // =========================================================

    // --- Color mode ---
    colorModeRadios.forEach(r => r.addEventListener('change', () => {
        state.colorMode = document.querySelector('input[name="color-mode"]:checked').value;
        singleColorPanel.classList.toggle('id-hidden', state.colorMode !== 'single');
        gradientColorPanel.classList.toggle('id-hidden', state.colorMode !== 'gradient');
        renderAll();
    }));

    // Preset color buttons
    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.neonColor = btn.dataset.color;
            customColorInput.value = state.neonColor;
            renderAll();
        });
    });
    customColorInput.addEventListener('input', () => {
        state.neonColor = customColorInput.value;
        colorBtns.forEach(b => b.classList.remove('active'));
        renderAll();
    });

    // Background neon toggle
    bgPresetToggle.addEventListener('change', () => {
        state.useBgPreset = bgPresetToggle.checked;
        bgPresetVal.textContent = bgPresetToggle.checked ? 'ON' : 'OFF';
        renderAll();
    });

    // Gradient colors
    gradColor1Input.addEventListener('input', () => {
        state.gradColor1 = gradColor1Input.value;
        gradColor1Text.textContent = gradColor1Input.value;
        renderAll();
    });
    gradColor2Input.addEventListener('input', () => {
        state.gradColor2 = gradColor2Input.value;
        gradColor2Text.textContent = gradColor2Input.value;
        renderAll();
    });
    gradTypeRadios.forEach(r => r.addEventListener('change', () => {
        state.gradType = document.querySelector('input[name="grad-type"]:checked').value;
        renderAll();
    }));

    // Sliders
    setupSlider(glowBlurInput, glowBlurVal, 'px', 'glowBlur', v => Math.round(v));
    setupSlider(glowIntInput, glowIntVal, '', 'glowIntensity', v => Math.round(v));
    setupSlider(shadowOpacityInput, shadowOpacityVal, '', 'shadowOpacity', v => parseFloat(v.toFixed(1)));
    setupSlider(shadowBlurInput, shadowBlurVal, 'px', 'shadowBlur', v => Math.round(v));
    setupSlider(shadowOffsetXInput, shadowOffsetXVal, '', 'shadowOffsetX', v => Math.round(v));
    setupSlider(shadowOffsetYInput, shadowOffsetYVal, '', 'shadowOffsetY', v => Math.round(v));
    setupSlider(imgScaleInput, imgScaleVal, '%', 'imgScale', v => v / 100);
    setupSlider(imgXInput, imgXVal, '', 'imgX', v => Math.round(v));
    setupSlider(imgYInput, imgYVal, '', 'imgY', v => Math.round(v));
    setupSlider(decorScaleInput, decorScaleVal, '%', 'decorScale', v => v / 100);
    setupSlider(decorXInput, decorXVal, '', 'decorX', v => Math.round(v));
    setupSlider(decorYInput, decorYVal, '', 'decorY', v => Math.round(v));
    setupSlider(decorRotateInput, decorRotateVal, '°', 'decorRotate', v => Math.round(v));

    // 画像の変形（縮小率・位置）がスライダー変更されたら各モードに合わせて再サンプリング・追従合成する (v6/v7)
    const onImgTransformChange = () => {
        if (uploadedImageSource) {
            if (currentInputMode === 'paint') {
                importImageToPaintGrid(uploadedImageSource);
                applyPaintToBadge();
            } else {
                originalImage = uploadedImageSource;
                renderAll();
            }
        }
    };
    if (imgScaleInput) imgScaleInput.addEventListener('input', onImgTransformChange);
    if (imgXInput) imgXInput.addEventListener('input', onImgTransformChange);
    if (imgYInput) imgYInput.addEventListener('input', onImgTransformChange);

    // --- Decoration buttons ---
    decorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            decorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.decorType = btn.dataset.decor;
            decorControls.classList.toggle('id-hidden', state.decorType === 'none');
            renderAll();
        });
    });

    // Decoration depth
    decorDepthRadios.forEach(r => r.addEventListener('change', () => {
        state.decorDepth = document.querySelector('input[name="decor-depth"]:checked').value;
        renderAll();
    }));

    // Decoration color mode
    decorColorModeRadios.forEach(r => r.addEventListener('change', () => {
        state.decorColorMode = document.querySelector('input[name="decor-color-mode"]:checked').value;
        decorSinglePanel.classList.toggle('id-hidden', state.decorColorMode !== 'single');
        decorGradPanel.classList.toggle('id-hidden', state.decorColorMode !== 'gradient');
        decorMetallicPanel.classList.toggle('id-hidden', state.decorColorMode !== 'metallic');
        renderAll();
    }));

    decorColorInput.addEventListener('input', () => {
        state.decorColor = decorColorInput.value;
        decorColorText.textContent = decorColorInput.value;
        renderAll();
    });
    decorGrad1Input.addEventListener('input', () => {
        state.decorGrad1 = decorGrad1Input.value;
        decorGrad1Text.textContent = decorGrad1Input.value;
        renderAll();
    });
    decorGrad2Input.addEventListener('input', () => {
        state.decorGrad2 = decorGrad2Input.value;
        decorGrad2Text.textContent = decorGrad2Input.value;
        renderAll();
    });
    decorGradTypeRadios.forEach(r => r.addEventListener('change', () => {
        state.decorGradType = document.querySelector('input[name="decor-grad-type"]:checked').value;
        renderAll();
    }));

    metalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            metalBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.decorMetal = btn.dataset.metal;
            renderAll();
        });
    });

    // --- Preview BG toggle ---
    bgToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            bgToggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.bg;
            bgWrappers.forEach(w => {
                w.classList.remove('transparent-grid', 'bg-dark-mode', 'bg-light-mode');
                if (mode === 'transparent') w.classList.add('transparent-grid');
                else if (mode === 'dark')  w.classList.add('bg-dark-mode');
                else                       w.classList.add('bg-light-mode');
            });
        });
    });

    // --- Chat theme tabs ---
    chatTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            chatTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const theme = btn.dataset.chatTheme;
            chatBox.classList.remove('chat-dark', 'chat-light');
            chatBox.classList.add(theme === 'dark' ? 'chat-dark' : 'chat-light');
        });
    });

    // =========================================================
    // 12. Bits Preset application
    // =========================================================
    // =========================================================
    // 12. Bits Preset application & Neon sync (v4)
    // =========================================================
    document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.preset;
            const preset = BITS_PRESETS[key];
            if (!preset) return;

            // 背景＆輪郭の両方にプリセット色を適用
            state.bgPresetColor  = preset.bgColor;
            state.bgPresetColor2 = preset.bgColor2 || null;
            state.useBgPreset    = true;

            // ネオン効果を強制的に有効化
            state.useNeon = true;
            neonEffectToggle.checked = true;
            neonEffectVal.textContent = 'ON';
            neonControlsWrapper.classList.remove('id-hidden');

            // バッジの輪郭ネオン色も同期
            state.colorMode = 'single';
            state.neonColor = preset.bgColor;
            customColorInput.value = preset.bgColor;

            // UIカラーモードラジオボタンを同期
            const singleRadio = document.querySelector('input[name="color-mode"][value="single"]');
            if (singleRadio) singleRadio.checked = true;
            singleColorPanel.classList.remove('id-hidden');
            gradientColorPanel.classList.add('id-hidden');

            // 背景ネオントグルUIを同期
            bgPresetToggle.checked = true;
            bgPresetVal.textContent = 'ON';

            // 適用済みカラーボタンのハイライトを解除
            colorBtns.forEach(b => b.classList.remove('active'));

            // 適用済みプリセットボタンをハイライト
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('applied'));
            btn.classList.add('applied');

            renderAll();
        });
    });

    // 【エフェクトなし】シンプルリサイズボタンの機能実装
    const btnEffectNone = document.getElementById('btn-effect-none');
    if (btnEffectNone) {
        btnEffectNone.addEventListener('click', () => {
            // ネオン効果無効
            state.useNeon = false;
            neonEffectToggle.checked = false;
            neonEffectVal.textContent = 'OFF';
            neonControlsWrapper.classList.add('id-hidden');

            // 背景ネオン無効
            state.useBgPreset = false;
            bgPresetToggle.checked = false;
            bgPresetVal.textContent = 'OFF';

            // シャドウ無効
            state.shadowOpacity = 0;
            shadowOpacityInput.value = 0;
            shadowOpacityVal.textContent = '0';
            syncSliderFill(shadowOpacityInput);

            // 装飾なし
            state.decorType = 'none';
            decorBtns.forEach(b => b.classList.remove('active'));
            const noneDecorBtn = document.querySelector('.decor-btn[data-decor="none"]');
            if (noneDecorBtn) noneDecorBtn.classList.add('active');
            decorControls.classList.add('id-hidden');

            // プリセットボタンのハイライト解除
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('applied'));

            renderAll();
        });
    }

    // ネオン効果ON/OFFトグルのリスナー
    if (neonEffectToggle) {
        neonEffectToggle.addEventListener('change', () => {
            state.useNeon = neonEffectToggle.checked;
            neonEffectVal.textContent = state.useNeon ? 'ON' : 'OFF';
            neonControlsWrapper.classList.toggle('id-hidden', !state.useNeon);
            renderAll();
        });
    }

    // =========================================================
    // 13. Download
    // =========================================================
    downloadBtn.addEventListener('click', async () => {
        if (!originalImage) return;

        if (typeof JSZip === 'undefined') {
            alert('JSZipライブラリを読み込み中です。少しお待ちください。');
            return;
        }

        const zip = new JSZip();
        const folder = zip.folder('twitch-badges');

        await Promise.all([72, 36, 18].map(size => new Promise(resolve => {
            canvases[size].toBlob(blob => {
                folder.file(`${originalFileName}_${size}x${size}.png`, blob);
                resolve();
            }, 'image/png');
        })));

        const content = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = `${originalFileName}_twitch_badges.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
    });

    // チャンネルポイント用3サイズ一括ダウンロード (v30)
    if (downloadChannelPointsBtn) {
        downloadChannelPointsBtn.addEventListener('click', async () => {
            if (!originalImage) return;

            if (typeof JSZip === 'undefined') {
                alert('JSZipライブラリを読み込み中です。少しお待ちください。');
                return;
            }

            const zip = new JSZip();
            const folder = zip.folder('channel-points');

            const sizes = [112, 56, 28];
            await Promise.all(sizes.map(size => new Promise(resolve => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = size;
                tempCanvas.height = size;
                renderBadgeToCanvas(tempCanvas, size);
                tempCanvas.toBlob(blob => {
                    folder.file(`${originalFileName}_${size}x${size}.png`, blob);
                    resolve();
                }, 'image/png');
            })));

            const content = await zip.generateAsync({ type: 'blob' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(content);
            a.download = `${originalFileName}_channel_points.zip`;
            a.click();
            URL.revokeObjectURL(a.href);
        });
    }



    // =========================================================
    // 14. Initial slider fill sync
    // =========================================================
    document.querySelectorAll('.neon-slider').forEach(syncSliderFill);

    // =========================================================
    // 15. Paint Editor - ドット絵ペイントエディタ (v4)
    // =========================================================
    // (※ 巻き上げ時の初期化順エラーを回避するため、変数宣言はファイル先頭へ移動しました)

    const toolPencil   = document.getElementById('tool-pencil');
    const toolEraser   = document.getElementById('tool-eraser');
    const toolBucket   = document.getElementById('tool-bucket');
    const toolClear    = document.getElementById('tool-clear');

    // Initialize paint grid
    function initPaintGrid() {
        paintGrid = [];
        for (let y = 0; y < paintGridSize; y++) {
            paintGrid.push(new Array(paintGridSize).fill(null));
        }
        // 初回履歴を初期化 (v7.5)
        paintHistory = [JSON.parse(JSON.stringify(paintGrid))];
        updateUndoButtonState();

        drawPaintGrid();
        applyPaintToBadge();
    }

    // Draw grid to paint Canvas
    function drawPaintGrid() {
        if (!paintCanvas) return;
        const cellSize = paintCanvas.width / paintGridSize;
        const pCtx = paintCanvas.getContext('2d');
        pCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);

        // 1. Draw checkered pattern background for transparency helper
        for (let y = 0; y < paintGridSize; y++) {
            for (let x = 0; x < paintGridSize; x++) {
                pCtx.fillStyle = (x + y) % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
                pCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

                // Draw pixel if colored
                if (paintGrid[y] && paintGrid[y][x]) {
                    pCtx.fillStyle = paintGrid[y][x];
                    pCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
        }

        // 2. Draw subtle grid lines
        pCtx.strokeStyle = 'rgba(255,255,255,0.06)';
        pCtx.lineWidth = 1;
        pCtx.beginPath();
        for (let i = 0; i <= paintGridSize; i++) {
            pCtx.moveTo(i * cellSize, 0);
            pCtx.lineTo(i * cellSize, paintCanvas.height);
            pCtx.moveTo(0, i * cellSize);
            pCtx.lineTo(paintCanvas.width, i * cellSize);
        }
        pCtx.stroke();
    }

    // Apply paint grid onto badge generator
    function applyPaintToBadge() {
        if (!paintCompositeCanvas) {
            paintCompositeCanvas = document.createElement('canvas');
        }
        // 動的なグリッドサイズに合わせる (v7.5)
        paintCompositeCanvas.width = paintGridSize;
        paintCompositeCanvas.height = paintGridSize;
        
        const tCtx = paintCompositeCanvas.getContext('2d');
        tCtx.clearRect(0, 0, paintGridSize, paintGridSize);

        // Draw grid onto it
        let hasPixels = false;
        for (let y = 0; y < paintGridSize; y++) {
            for (let x = 0; x < paintGridSize; x++) {
                if (paintGrid[y] && paintGrid[y][x]) {
                    tCtx.fillStyle = paintGrid[y][x];
                    tCtx.fillRect(x, y, 1, 1);
                    hasPixels = true;
                }
            }
        }

        if (!hasPixels) return;

        // Canvas要素を直接 originalImage として割り当てる (同期・超高速化・レースコンディション撲滅) (v7.5)
        originalImage = paintCompositeCanvas;
        originalFileName = 'custom-pixel-badge';
        enableAccordions();
        renderAll();
    }

    // Flood fill algorithm for Paint Bucket
    function floodFill(startX, startY, fillColor) {
        if (!paintGrid[startY]) return;
        const targetColor = paintGrid[startY][startX];
        if (targetColor === fillColor) return;

        const queue = [[startX, startY]];
        while (queue.length > 0) {
            const [cx, cy] = queue.shift();
            if (cx < 0 || cx >= paintGridSize || cy < 0 || cy >= paintGridSize) continue;
            if (paintGrid[cy][cx] !== targetColor) continue;

            paintGrid[cy][cx] = fillColor;
            queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
    }

    // Draw pixel on pointer move/click
    function handlePaintEvent(e) {
        if (!paintCanvas) return;
        const rect = paintCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const x = Math.floor((clientX - rect.left) / (rect.width / paintGridSize));
        const y = Math.floor((clientY - rect.top) / (rect.height / paintGridSize));

        if (x >= 0 && x < paintGridSize && y >= 0 && y < paintGridSize) {
            if (currentPaintTool === 'pencil') {
                paintGrid[y][x] = currentPaintColor;
            } else if (currentPaintTool === 'eraser') {
                paintGrid[y][x] = null;
            } else if (currentPaintTool === 'bucket') {
                floodFill(x, y, currentPaintColor);
            }
            drawPaintGrid();
            applyPaintToBadge();
        }
    }

    // 描画セッション終了ヘルパー関数 (v7.5バグ修正)
    function stopPaintingSession() {
        if (isPainting) {
            isPainting = false;
            savePaintHistory(); // ストローク終了時の最新の状態を履歴にプッシュ
        }
    }

    // Wire up paint events
    if (paintCanvas) {
        paintCanvas.addEventListener('mousedown', (e) => {
            isPainting = true;
            handlePaintEvent(e);
        });
        paintCanvas.addEventListener('mousemove', (e) => {
            if (isPainting) handlePaintEvent(e);
        });
        window.addEventListener('mouseup', stopPaintingSession);

        // Touch support for mobile devices
        paintCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isPainting = true;
            handlePaintEvent(e);
        });
        paintCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (isPainting) handlePaintEvent(e);
        });
        window.addEventListener('touchend', stopPaintingSession);
    }

    // Tool buttons
    if (toolPencil) {
        toolPencil.addEventListener('click', () => {
            currentPaintTool = 'pencil';
            document.querySelectorAll('.paint-tool-btn').forEach(b => b.classList.remove('active'));
            toolPencil.classList.add('active');
        });
    }
    if (toolEraser) {
        toolEraser.addEventListener('click', () => {
            currentPaintTool = 'eraser';
            document.querySelectorAll('.paint-tool-btn').forEach(b => b.classList.remove('active'));
            toolEraser.classList.add('active');
        });
    }
    if (toolBucket) {
        toolBucket.addEventListener('click', () => {
            currentPaintTool = 'bucket';
            document.querySelectorAll('.paint-tool-btn').forEach(b => b.classList.remove('active'));
            toolBucket.classList.add('active');
        });
    }
    if (toolClear) {
        toolClear.addEventListener('click', () => {
            if (confirm('キャンバスのドット絵をすべて消去しますか？')) {
                savePaintHistory(); // クリア前に履歴を保存 (v7.5)
                initPaintGrid();
            }
        });
    }

    // Undo 履歴の保存と復元ヘルパー関数 (v7.5)
    function savePaintHistory() {
        const maxHistory = 30;
        if (paintHistory.length >= maxHistory) {
            paintHistory.shift();
        }
        paintHistory.push(JSON.parse(JSON.stringify(paintGrid)));
        updateUndoButtonState();
    }

    function undoPaint() {
        if (paintHistory.length <= 1) return;
        
        paintHistory.pop(); // 現在の状態を取り除く
        const prevState = paintHistory[paintHistory.length - 1];
        paintGrid = JSON.parse(JSON.stringify(prevState));
        
        drawPaintGrid();
        applyPaintToBadge();
        updateUndoButtonState();
    }

    function updateUndoButtonState() {
        if (toolPaintUndo) {
            if (paintHistory.length > 1) {
                toolPaintUndo.classList.remove('btn-disabled');
                toolPaintUndo.disabled = false;
            } else {
                toolPaintUndo.classList.add('btn-disabled');
                toolPaintUndo.disabled = true;
            }
        }
    }

    if (toolPaintUndo) {
        toolPaintUndo.addEventListener('click', undoPaint);
    }

    // Grid size radio
    document.querySelectorAll('input[name="paint-grid-size"]').forEach(radio => {
        radio.addEventListener('change', () => {
            paintGridSize = parseInt(document.querySelector('input[name="paint-grid-size"]:checked').value);
            // もしすでに画像がロードされている場合は、そこから再抽出してインポート (v5)
            if (originalImage) {
                importImageToPaintGrid(originalImage);
                applyPaintToBadge();
            } else {
                initPaintGrid();
            }
        });
    });

    // Palette Colors
    document.querySelectorAll('.palette-color:not(.custom-trigger)').forEach(p => {
        p.addEventListener('click', () => {
            document.querySelectorAll('.palette-color').forEach(b => b.classList.remove('active'));
            p.classList.add('active');
            currentPaintColor = p.dataset.color;
            paintCustomColor.value = currentPaintColor;
        });
    });
    if (paintCustomColor) {
        paintCustomColor.addEventListener('input', () => {
            currentPaintColor = paintCustomColor.value;
            document.querySelectorAll('.palette-color').forEach(b => b.classList.remove('active'));
        });
    }

    // Tabs toggle (v4/v7)
    if (tabUploadBtn && tabPaintBtn) {
        tabUploadBtn.addEventListener('click', () => {
            currentInputMode = 'upload';
            tabUploadBtn.classList.add('active');
            tabPaintBtn.classList.remove('active');
            panelUpload.classList.remove('id-hidden');
            panelPaint.classList.add('id-hidden');
            
            // アップロード画像をそのまま適用
            if (uploadedImageSource) {
                originalImage = uploadedImageSource;
                renderAll();
            }
        });
        
        tabPaintBtn.addEventListener('click', () => {
            currentInputMode = 'paint';
            tabPaintBtn.classList.add('active');
            tabUploadBtn.classList.remove('active');
            panelPaint.classList.remove('id-hidden');
            panelUpload.classList.add('id-hidden');
            
            if (paintGrid.length === 0) {
                initPaintGrid();
            } else {
                applyPaintToBadge();
            }
        });
    }

    // =========================================================
    // 16. Drag-and-Drop Decoration & Image in Preview Canvas (v5/v6)
    // =========================================================
    let isDraggingDecor = false;
    let isDraggingImg   = false;
    let dragStartMouseX = 0;
    let dragStartMouseY = 0;
    let dragStartDecorX = 0;
    let dragStartDecorY = 0;
    let dragStartImgX   = 0;
    let dragStartImgY   = 0;

    const canvas72 = canvases[72];

    function handleCanvasDragStart(e) {
        if (!originalImage) return;

        const rect = canvas72.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // 72pxキャンバス論理サイズに座標をスケーリング
        const mouseX = ((clientX - rect.left) / rect.width) * 72;
        const mouseY = ((clientY - rect.top) / rect.height) * 72;

        let clickedDecor = false;

        // 装飾パーツが有効なら、装飾パーツとの当たり判定を行う
        if (state.decorType !== 'none') {
            const cx = 72 / 2 + state.decorX;
            const cy = 72 / 2 + state.decorY;
            const dx = mouseX - cx;
            const dy = mouseY - cy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const decorRadius = (72 * state.decorScale) / 2;

            if (distance <= decorRadius + 6) { // 6px判定バッファ
                clickedDecor = true;
            }
        }

        isPainting = false; // ドット絵キャンバス描画と干渉するのを防止

        if (clickedDecor) {
            // 装飾パーツのドラッグ開始
            isDraggingDecor = true;
            isDraggingImg = false;
            canvas72.style.cursor = 'grabbing';
            dragStartMouseX = clientX;
            dragStartMouseY = clientY;
            dragStartDecorX = state.decorX;
            dragStartDecorY = state.decorY;
        } else {
            // バッジ画像自体のドラッグ開始 (v6)
            isDraggingImg = true;
            isDraggingDecor = false;
            canvas72.style.cursor = 'move';
            dragStartMouseX = clientX;
            dragStartMouseY = clientY;
            dragStartImgX = state.imgX;
            dragStartImgY = state.imgY;
        }
    }

    function handleCanvasDragMove(e) {
        if (!isDraggingDecor && !isDraggingImg) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // 移動差分
        const dxPixels = clientX - dragStartMouseX;
        const dyPixels = clientY - dragStartMouseY;

        const rect = canvas72.getBoundingClientRect();
        const scaleX = 72 / rect.width;
        const scaleY = 72 / rect.height;

        const dx = dxPixels * scaleX;
        const dy = dyPixels * scaleY;

        if (isDraggingDecor) {
            // 装飾パーツの座標移動
            state.decorX = Math.max(-50, Math.min(50, Math.round(dragStartDecorX + dx)));
            state.decorY = Math.max(-50, Math.min(50, Math.round(dragStartDecorY + dy)));

            // 左側のX, YスライダーUIと連動同期
            if (decorXInput) {
                decorXInput.value = state.decorX;
                decorXVal.textContent = state.decorX;
                syncSliderFill(decorXInput);
            }
            if (decorYInput) {
                decorYInput.value = state.decorY;
                decorYVal.textContent = state.decorY;
                syncSliderFill(decorYInput);
            }
        } else if (isDraggingImg) {
            // バッジ画像自体の座標移動 (v6)
            state.imgX = Math.max(-50, Math.min(50, Math.round(dragStartImgX + dx)));
            state.imgY = Math.max(-50, Math.min(50, Math.round(dragStartImgY + dy)));

            // 左側のX, YスライダーUIと連動同期
            if (imgXInput) {
                imgXInput.value = state.imgX;
                imgXVal.textContent = state.imgX;
                syncSliderFill(imgXInput);
            }
            if (imgYInput) {
                imgYInput.value = state.imgY;
                imgYVal.textContent = state.imgY;
                syncSliderFill(imgYInput);
            }
        }

        renderAll();
    }

    function handleCanvasDragEnd() {
        if (isDraggingDecor) {
            isDraggingDecor = false;
            canvas72.style.cursor = 'grab';
        }
        if (isDraggingImg) {
            isDraggingImg = false;
            canvas72.style.cursor = 'grab';

            // 画像の移動が終わったら、その位置の情報を各モードに合わせて同期 (v6/v7)
            if (uploadedImageSource) {
                if (currentInputMode === 'paint') {
                    importImageToPaintGrid(uploadedImageSource);
                    applyPaintToBadge();
                }
            }
        }
    }

    if (canvas72) {
        // マウスイベント
        canvas72.addEventListener('mousedown', handleCanvasDragStart);
        window.addEventListener('mousemove', handleCanvasDragMove);
        window.addEventListener('mouseup', handleCanvasDragEnd);

        // タッチイベント (スマートフォン対応)
        canvas72.addEventListener('touchstart', (e) => {
            handleCanvasDragStart(e);
            // ドラッグ対象を掴んでいるときは、背後の画面スクロールを抑止
            if (isDraggingDecor || isDraggingImg) e.preventDefault();
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (isDraggingDecor || isDraggingImg) {
                e.preventDefault();
                handleCanvasDragMove(e);
            }
        }, { passive: false });

        window.addEventListener('touchend', handleCanvasDragEnd);
    }

    // =========================================================
    // 7. テーマ切り替え機能 (ライト/ダークモード) (v26)
    // =========================================================
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        // ローカルストレージから前回のテーマを復元
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }

        themeToggleBtn.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-mode');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
        });
    }

});

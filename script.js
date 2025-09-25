// --- カスタムウィンドウ関連 ---
const windows = [
  new ParamsWindow('param-global', 'rgba(224, 230, 255, 0.52)'),
];

const fileNameInput = windows[0].addTextInput('保存ファイル名', () => {
  if (fileNameInput.value.trim() === '') {
    fileNameInput.classList.add('blink');
  } else {
    fileNameInput.classList.remove('blink');
  }
});
fileNameInput.classList.add('blink');

let showMode = 'processed'; // 現在の描画モード
let updatePhase = 0; // コンフィグの状態
let frameIndex = 0; // 現在のフレーム番号
let frameCfgIndex = 0; // 現在のコンフィグフレーム番号
let cfgToggleStates = []; // コンフィグボタンのトグル状態
let cfgIsPressed = false; // コンフィグボタンの押下状態

// colorBlock ... label(色の名前): { color: 色の値, sliders: {} }
let currentConfig = { bgColor: '#ffffff', bgLabelColor: '#ffffff', colorBlocks: {} }; // 表示中のコンフィグデータ
let globalConfig = null; // グローバルコンフィグ
let frameConfigs = []; // フレームコンフィグ
const frameBtns = []; // フレームボタン用

let processedImages = { pressure: [], log: [], processed: [] }; // 処理後画像の保持
let uploadedImages = []; // アップロードした画像
let drawImages = []; // マーキング画像

let cursorMode = 'camera'; // 現在のカーソルモード
const modeList = { 'デフォルト':'camera', '閾値上げ':'highTh', '閾値下げ':'lowTh' }; // カーソルモードと表示名の対応

const defaultSliderValue = { threshold: 0, log: 0, weight: 0 };
const gValueRanges = { threshold: [0, 1], log: [0, 10], weight: [0, 10] };
let colorEditorMode = 'global';
let pColorEditorMode = colorEditorMode;

//// HTML要素
// エディター画面 (中央エリア)
const editorContent = document.querySelector(".editor-content");
editorContent.innerHTML = `
  <h1>編集画面</h1>
  <p>ここに画像をドラッグ＆ドロップしてください</p>
  <canvas id="canvas"></canvas>
  <canvas id="drawCanvas"></canvas>
  <canvas id="overlayCanvas"></canvas>
  <canvas id="offscreenCanvas"></canvas>
`;
const dropZone = document.getElementById("drop-zone");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const drawCanvas = document.getElementById("drawCanvas");
const dctx = drawCanvas.getContext('2d', { willReadFrequently: true });
const overlayCanvas = document.getElementById("overlayCanvas");
const octx = overlayCanvas.getContext('2d', { willReadFrequently: true });
const offscreenCanvas = document.getElementById("offscreenCanvas");
const osctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
// フレームメニュー (右エリア)
const menuContent = document.querySelector(".menu-content");
const previewCanvas = document.getElementById('previewCanvas');
const pctx = previewCanvas.getContext('2d');
// カラー編集 (下部エリア)
const colorEditorTitle = document.getElementById("color-editor-title");
let bgPicker = null;
let bgLabelPicker = null;

function changeShowMode(mode) {
  showMode = mode;
  prepareAndShowImage(frameIndex, showMode);
}
windows[0].addButton('<i class="fa-solid fa-image"></i> 入力画像', () => changeShowMode('original'), true, 'rgb(0, 185, 40)');
windows[0].addButton('<i class="fa-regular fa-image"></i> 出力画像', () => changeShowMode('processed'), true, 'rgb(0, 185, 40)');
windows[0].addButton('<i class="fa-solid fa-pencil"></i> 筆圧値', () => changeShowMode('pressure'), true);
windows[0].addButton('<i class="fa-solid fa-wave-square"></i> 線検知フィルタ', () => changeShowMode('log'), true);
// windows[0].addButton("DEBUG", changeShowMode('DEBUG'), true);

const cursorModeList = windows[0].addDropdown('カーソルモード', ['デフォルト', '閾値上げ', '閾値下げ'], (e) => { cursorMode = modeList[e]; }, 'rgba(89, 98, 219, 1)');

const allProcBtn = windows[0].addButton('<i class="fa-solid fa-images"></i> 全画像処理', processAllImages, false, 'rgb(0, 153, 221)');

async function processAllImages(){
  if(showMode === 'original') await changeShowMode('processed');
  for (let i = 0; i < uploadedImages.length; i++) {
    await prepareAndShowImage(i, showMode);
  }
  await prepareAndShowImage(frameIndex, showMode);
  showStatus('全画像の処理を実行しました。', 'success', 3000);
}

const fileExtList = windows[0].addDropdown('保存形式', ['', 'png', 'tif', 'tga'], () => {}, 'rgb(0, 185, 40)');

windows[0].addButton('<i class="fas fa-file-download"></i> 保存', saveImages, false, 'rgb(0, 153, 221)');

exportBtn.addEventListener('click', saveConfig);

// --- ウィンドウ表示切替 ---
let visible = true;
const toggleButton = document.getElementById('toggleButton');
toggleButton.addEventListener('click', () => {
  visible = !visible;
  windows.forEach(w => w.toggle(visible));
  toggleButton.textContent = visible ? 'ウィンドウ非表示' : 'ウィンドウ表示';
});
windows.forEach(w => w.toggle(visible));
// ウィンドウのトグルボタンは一旦非表示
toggleButton.style.display = 'none';

// ページ設定
document.addEventListener('DOMContentLoaded', () => {
  // ドラッグドロップとボタン押下によるコンフィグのロード (インポート)
  const cfgDropZone = document.getElementById('cfg-drop-zone');
  const importBtn = document.getElementById('importColorsBtn');
  const fileInput = document.getElementById('configFileInput');

  // ボタンを押したら非表示inputをクリック
  importBtn.addEventListener('click', () => { fileInput.click(); });
  /** input の change でファイルを処理 */
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
      loadConfigFile(fileInput.files[0]);
    }
  });
  /** ドラッグしたファイルをドロップ可能にする */
  cfgDropZone.addEventListener('dragover', e => {
    e.preventDefault();             // 必須：デフォルト動作（禁止カーソル）を抑止
    cfgDropZone.classList.add('dragover');
  });
  cfgDropZone.addEventListener('dragleave', e => {
    e.preventDefault();
    cfgDropZone.classList.remove('dragover');
  });
  cfgDropZone.addEventListener('drop', e => {
    e.preventDefault();
    cfgDropZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) {
      loadConfigFile(e.dataTransfer.files[0]);
    }
  });

  // ConfigFileロード関数
  function loadConfigFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        // Reset and render color blocks from the loaded config (rebuild DOM & currentConfig)
        renderColorBlocksFromConfig(parsed);
        updateConfig();
        ++updatePhase;
        prepareAndShowImage(frameIndex, showMode);
        localStorage.setItem("localConfigData", JSON.stringify(globalConfig));
        showStatus('Configファイルの読み込みが完了しました。', 'success', 3000);
      } catch (error) {
        console.error('Error loading config:', error);
        showStatus('Configファイルの読み込みに失敗しました。', 'error', 3000);
      }
    };
    reader.readAsText(file);
  }

  const topContainer = document.querySelector('.top-container');
  const mainEditorPanel = document.querySelector('.main-editor-panel');
  const frameMenuPanel = document.querySelector('.frame-menu-panel');
  const colorEditorPanel = document.querySelector('.color-editor-panel');
  const resizerV = document.querySelector('.resizer-v');
  const resizerH = document.querySelector('.resizer-h');

  let isResizingV = false;
  let isResizingH = false;
  let startX = 0;
  let startY = 0;
  let startMainWidth = 0;
  let startFrameWidth = 0;
  let startTopHeight = 0;
  let startColorHeight = 0;

  const minWidth = 100;
  const minHeight = 100;

  // 垂直リサイザー（V）
  resizerV.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizingV = true;
    startX = e.clientX;
    startMainWidth = mainEditorPanel.offsetWidth;
    startFrameWidth = frameMenuPanel.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  // 水平リサイザー（H）
  resizerH.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizingH = true;
    startY = e.clientY;
    startTopHeight = topContainer.offsetHeight;
    startColorHeight = colorEditorPanel.offsetHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (isResizingV) {
      const deltaX = e.clientX - startX;
      const newMainWidth = Math.max(minWidth, startMainWidth + deltaX);
      const newFrameWidth = Math.max(minWidth, startFrameWidth - deltaX);

      if (newMainWidth >= minWidth && newFrameWidth >= minWidth) {
        mainEditorPanel.style.width = `${newMainWidth}px`;
        frameMenuPanel.style.width = `${newFrameWidth}px`;
      } else {
        if (newMainWidth < minWidth) {
          mainEditorPanel.style.width = `${minWidth}px`;
          frameMenuPanel.style.width = `${startFrameWidth - (minWidth - startMainWidth)}px`;
        } else if (newFrameWidth < minWidth) {
          frameMenuPanel.style.width = `${minWidth}px`;
          mainEditorPanel.style.width = `${startMainWidth + (startFrameWidth - minWidth)}px`;
        }
      }
    }

    if (isResizingH) {
      const deltaY = e.clientY - startY;
      const newTopHeight = Math.max(minHeight, startTopHeight + deltaY);
      const newColorHeight = Math.max(minHeight, startColorHeight - deltaY);

      if (newTopHeight >= minHeight && newColorHeight >= minHeight) {
        topContainer.style.height = `${newTopHeight}px`;
        colorEditorPanel.style.height = `${newColorHeight}px`;
      } else {
        if (newTopHeight < minHeight) {
          topContainer.style.height = `${minHeight}px`;
          colorEditorPanel.style.height = `${startColorHeight - (minHeight - startTopHeight)}px`;
        } else if (newColorHeight < minHeight) {
          colorEditorPanel.style.height = `${minHeight}px`;
          topContainer.style.height = `${startTopHeight + (startColorHeight - minHeight)}px`;
        }
      }
    }
  });

  document.addEventListener('selectstart', (e) => {
    e.preventDefault();
  });

  document.addEventListener('mouseup', () => {
    if (isResizingV || isResizingH) {
      isResizingV = false;
      isResizingH = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    }
    buttonIsPressed = false;
    cfgIsPressed = false;
  });

  window.addEventListener('blur', () => {
    isResizingV = false;
    isResizingH = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = '';
  });

  // Load local config. If none exists, create default color blocks.
  loadLocalConfig();
  if (!currentConfig.colorBlocks || Object.keys(currentConfig.colorBlocks).length === 0) {
    createDefaultColorBlocks();
  } else {
    // Ensure DOM reflects the loaded config
    renderColorBlocksFromConfig(currentConfig);
  }
});

// 新しいカラーブロック要素を作成（削除ボタン付き）
function createColorBlock(initialLabelColor, initialColor) {
  const colorBlockSize = Object.keys(currentConfig.colorBlocks).length;
  const container = document.querySelector('.color-content');
  if (colorBlockSize != 0 && container.lastElementChild && container.lastElementChild.id == 'addColorBtn') container.lastElementChild.remove();

  // Keep block relatively positioned so delete button can be placed in top-right.
  let html = `
    <div class="color-block" data-label="${colorBlockSize}" style="position:relative;">
      <!-- Top-right: enable/disable checkbox -->
      <input type="checkbox" class="color-enable" title="有効/無効" style="position:absolute; right:4px; top:4px; width:20px; height:20px;" checked />
      <!-- Left-bottom: delete button (moved here) with red background -->
      <button class="color-delete" title="削除" style="position:absolute; right:6px; bottom:6px; width:20px; height:20px; line-height:16px; padding:0; border-radius:3px; background:red; color:white; border:none;">×</button>
      <div class="color-control-group">
        <div class="picker-stack">
          <input type="color" class="color-picker" value="${initialColor}" data-label="${colorBlockSize}" />
          <span class="picker-arrow">▼</span>
          <input type="color" class="color-picker label-picker" value="${initialLabelColor}" >
        </div>
        <div class="sliders-container">
          <div class="slider-row">
            <span class="slider-label">閾値　</span>
            <input type="range" class="color-slider" min="0" max="1" step="0.01" value="0.5" data-channel="threshold"/>
            <input type="number" class="slider-value" min="0" max="1" step="0.01" value="0.5"/>
          </div>
          <div class="slider-row">
            <span class="slider-label">線検知</span>
            <input type="range" class="color-slider" min="0" max="10" step="0.1" value="0" data-channel="log">
            <input type="number" class="slider-value" min="0" max="10" step="0.1" value="0.0"/>
          </div>
          <div class="slider-row">
            <span class="slider-label">重み　</span>
            <input type="range" class="color-slider" min="0" max="10" step="0.1" value="1" data-channel="weight">
            <input type="number" class="slider-value" min="0" max="10" step="0.1" value="1.0"/>
          </div>
        </div>
      </div>
    </div>
    ${
      colorBlockSize < 7 ? `
        <button style="width: 50px;" id="addColorBtn" >
          ＋
        </button>
      ` : ``
    }
  `;

  container.insertAdjacentHTML('beforeend', html);

  // add button (if present) will be last element - ensure it creates a new color block
  const last = container.lastElementChild;
  if (last && last.id === 'addColorBtn') {
    last.addEventListener('click', () => {
      createColorBlock('#000000', '#000000');
    });
  }

  // initialize config entry for this block
  const sliders = { threshold: 0.5, log: 0, weight: 1 };
  // add enabled flag default true so checkbox state is tracked
  currentConfig.colorBlocks[colorBlockSize] = { color: initialColor, labelColor: initialLabelColor, sliders: sliders, enabled: true };
  applyCurrentConfig();
  
  // bind events
  const block = container.querySelector(`.color-block[data-label="${colorBlockSize}"]`);
  setupSliderListeners(block, colorBlockSize);
  setupColorPickerListeners(block, colorBlockSize);

  // delete button (confirm before deletion)
  const delBtn = block.querySelector('.color-delete');
  if (delBtn) {
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ok = window.confirm("本当にこの色を削除しますか？");
      if (ok) {
        deleteColorBlock(colorBlockSize);
      }
    });
  }
  
  // enable/disable checkbox listener
  const enableCheckbox = block.querySelector('.color-enable');
  if (enableCheckbox) {
    // initialize checked state from config (safeguard)
    enableCheckbox.checked = currentConfig.colorBlocks[colorBlockSize].enabled !== false;
    enableCheckbox.addEventListener('change', () => {
      currentConfig.colorBlocks[colorBlockSize].enabled = enableCheckbox.checked;
      applyCurrentConfig();
      ++updatePhase;
      prepareAndShowImage(frameIndex, showMode);
    });
  }
}

/* Create the background picker block and wire its listeners.
   The bg block provides both a color and a labelColor (styled like colorBlock pickers). */
function createBgBlock(initialBgColor = '#ffffff', initialLabelColor = '#000000') {
  const container = document.querySelector('.color-content');

  // Remove any existing bg-block if present
  const existing = container.querySelector('.bg-block');
  if (existing) existing.remove();

  const html = `
    <div class="bg-block" style="background:#ffffff; display:flex; justify-content:center; align-items:center; height:80px; padding:20px; margin-right:4px;">
      <span style="margin-right:8px;">背景</span>
      <div class="picker-stack">
        <input type="color" class="color-picker bg-color-picker" value="${initialBgColor}" data-label="bgColorPicker" />
        <span class="picker-arrow">▼</span>
        <input type="color" class="color-picker label-picker bg-label-picker" value="${initialLabelColor}" />
      </div>
    </div>
  `;
  container.insertAdjacentHTML('afterbegin', html);

  // wire references and listeners
  bgPicker = container.querySelector('.bg-color-picker');
  bgLabelPicker = container.querySelector('.bg-label-picker');

  // Initialize currentConfig properties if missing
  if (!currentConfig) currentConfig = { bgColor: initialBgColor, bgLabelColor: initialLabelColor, colorBlocks: {} };
  if (currentConfig.bgColor === undefined) currentConfig.bgColor = initialBgColor;
  if (currentConfig.bgLabelColor === undefined) currentConfig.bgLabelColor = initialLabelColor;

  if (bgPicker) {
    bgPicker.value = currentConfig.bgColor;
    bgPicker.addEventListener('input', () => {
      currentConfig.bgColor = bgPicker.value;
      applyCurrentConfig();
      ++updatePhase;
      prepareAndShowImage(frameIndex, showMode);
    });
  }
  if (bgLabelPicker) {
    bgLabelPicker.value = currentConfig.bgLabelColor || initialLabelColor;
    bgLabelPicker.addEventListener('input', () => {
      currentConfig.bgLabelColor = bgLabelPicker.value;
      applyCurrentConfig();
      ++updatePhase;
      prepareAndShowImage(frameIndex, showMode);
    });
  }
}

/* Render color blocks from a config object (resets DOM and currentConfig). */
function renderColorBlocksFromConfig(cfg) {
  if (!cfg) return;
  // Clone to avoid mutation
  currentConfig = JSON.parse(JSON.stringify(cfg));
  globalConfig = JSON.parse(JSON.stringify(cfg));

  const container = document.querySelector('.color-content');
  container.innerHTML = ''; // clear everything; we'll create bg + blocks from JS

  // Create bg block (cfg may include bgLabelColor)
  const bgColor = cfg.bgColor || '#ffffff';
  const bgLabelColor = cfg.bgLabelColor || cfg.bgLabel || '#000000';
  createBgBlock(bgColor, bgLabelColor);

  // Recreate blocks in order
  const entries = Object.entries(cfg.colorBlocks || {}).sort((a,b) => Number(a[0]) - Number(b[0]));
  currentConfig.colorBlocks = {};
  entries.forEach(([k, v]) => {
    const labelColor = v.labelColor || v.color || '#000000';
    const color = v.color || '#000000';
    createColorBlock(labelColor, color);
    const idx = Object.keys(currentConfig.colorBlocks).length - 1;
    if (v.sliders) {
      currentConfig.colorBlocks[idx].sliders = { ...defaultSliderValue, ...v.sliders };
    }
  });

  updateConfig();
}

/* Create 4 default color blocks (used when no local config present) */
function createDefaultColorBlocks() {
  currentConfig = { bgColor: '#ffffff', bgLabelColor: '#000000', colorBlocks: {} };
  const container = document.querySelector('.color-content');
  container.innerHTML = ''; // wipe

  // Create bg block first
  createBgBlock(currentConfig.bgColor, currentConfig.bgLabelColor);

  const defaults = [
    { labelColor:'#000000', color:'#000000' },
    { labelColor:'#ff0000', color:'#ff0000' },
    { labelColor:'#00ff00', color:'#00ff00' },
    { labelColor:'#0000ff', color:'#0000ff' },
  ];

  defaults.forEach(d => createColorBlock(d.labelColor, d.color));
  updateConfig();
}

/* Create 4 default color blocks (used when no local config present) */
function createDefaultColorBlocks() {
  currentConfig.colorBlocks = {};
  const container = document.querySelector('.color-content');
  const bgInput = container.querySelector('input[data-label="bgColorPicker"]');
  const bgHtml = bgInput ? bgInput.closest('div').outerHTML : '';
  container.innerHTML = bgHtml;

  const defaults = [
    { labelColor:'#000000', color:'#000000' },
    { labelColor:'#ff0000', color:'#ff0000' },
    { labelColor:'#00ff00', color:'#00ff00' },
    { labelColor:'#0000ff', color:'#0000ff' },
  ];

  defaults.forEach(d => createColorBlock(d.labelColor, d.color));
  updateConfig();
}

/* Delete a color block by its numeric label index, then reindex and re-render */
function deleteColorBlock(labelIndex) {
  const container = document.querySelector('.color-content');
  const toRemove = container.querySelector(`.color-block[data-label="${labelIndex}"]`);
  if (!toRemove) return;

  // Build new colorBlocks from remaining DOM blocks (preserve order)
  const remaining = Array.from(container.querySelectorAll('.color-block')).filter(b => b !== toRemove);
  const newBlocks = {};
  remaining.forEach((b, i) => {
    const color = b.querySelector('.color-picker')?.value || '#000000';
    const labelColor = b.querySelector('.label-picker')?.value || color;
    const sliders = {
      threshold: parseFloat(b.querySelector('.color-slider[data-channel="threshold"]')?.value) || defaultSliderValue.threshold,
      log: parseFloat(b.querySelector('.color-slider[data-channel="log"]')?.value) || defaultSliderValue.log,
      weight: parseFloat(b.querySelector('.color-slider[data-channel="weight"]')?.value) || defaultSliderValue.weight,
    };
    newBlocks[i] = { color, labelColor, sliders };
  });

  // Replace currentConfig and re-render
  currentConfig.colorBlocks = newBlocks;
  renderColorBlocksFromConfig(currentConfig);
  applyCurrentConfig();
  ++updatePhase;
  prepareAndShowImage(frameIndex, showMode);
}

/* Update existing color blocks from a cfg (used when switching between global/frame modes) */
function updateColorBlocks(cfg){ // カラーブロック値を更新
  const colorCfg = cfg ? cfg : globalConfig;
  if (!colorCfg) return;
  // If a frame config isn't provided, fall back to the globalConfig so sliders initialize from global values.
  const sliderCfg = cfg || globalConfig || null;
  const keys = Object.keys(currentConfig.colorBlocks);
  currentConfig.bgColor = colorCfg.bgColor;
  for(let i = 0; i < keys.length; ++i){ // 黒,赤,緑,青,...
    const key = keys[i];
    const src = (colorCfg.colorBlocks && colorCfg.colorBlocks[key]) ? colorCfg.colorBlocks[key] : null;
    if (src) {
      currentConfig.colorBlocks[key].color = src.color;
      currentConfig.colorBlocks[key].labelColor = src.labelColor;
      currentConfig.colorBlocks[key].sliders = (sliderCfg && sliderCfg.colorBlocks && sliderCfg.colorBlocks[key]) ? { ...sliderCfg.colorBlocks[key].sliders } : { ...defaultSliderValue };
    }
  }
  updateConfig();
  pColorEditorMode = colorEditorMode;
}

// currentConfig に表示中の値を代入 bgColor, colorBlks{col, lcol, sliders{...}}
function updateConfig(){
  // update bg pickers if present
  if (currentConfig.bgColor) {
    if (bgPicker) bgPicker.value = currentConfig.bgColor;
  }
  if (currentConfig.bgLabelColor !== undefined) {
    if (bgLabelPicker) bgLabelPicker.value = currentConfig.bgLabelColor;
  }

  if (currentConfig.colorBlocks) {
    for (const [label, colorBlock] of Object.entries(currentConfig.colorBlocks)) {
      currentConfig.colorBlocks[label].color = colorBlock.color;
      const picker = document.querySelector(`.color-block[data-label="${label}"] .color-picker`);
      if (picker) picker.value = colorBlock.color;
      
      currentConfig.colorBlocks[label].labelColor = colorBlock.labelColor;
      const arrow = picker.nextElementSibling;
      const labelPicker = arrow ? arrow.nextElementSibling : null;
      if (labelPicker) labelPicker.value = colorBlock.labelColor;
      if (colorBlock.sliders) {
        for (const [param, value] of Object.entries(colorBlock.sliders)) { // param ... th, log, wei | value ... 0.5, 0, 1.0
          currentConfig.colorBlocks[label].sliders[param] = value;
          const slider = document.querySelector(`.color-block[data-label="${label}"] .color-slider[data-channel="${param}"]`);
          const number = slider?.parentElement.querySelector('.slider-value');
          // Slider range switching between global/frame removed.
          // Sliders use their stored absolute values; ranges remain the global ranges in UI.
          if (slider) slider.value = value;
          if (number) number.value = value;
        }
      }
      // Sync enabled checkbox state if present
      const enableCheckbox = document.querySelector(`.color-block[data-label="${label}"] .color-enable`);
      if (enableCheckbox) {
        // default to true unless explicitly false in cfg
        enableCheckbox.checked = (colorBlock.enabled === undefined) ? true : !!colorBlock.enabled;
        // ensure config has the enabled flag present
        currentConfig.colorBlocks[label].enabled = enableCheckbox.checked;
      }
    }
  }
  applyCurrentConfig();
}

// スライダーの処理
function setupSliderListeners(container, label) {
  const sliderRows = container.querySelectorAll('.slider-row');
  sliderRows.forEach((row, i) => {
    const slider = row.querySelector('.color-slider');
    const number = row.querySelector('.slider-value');
    // スライダー変更による更新
    slider.addEventListener('input', () => {
      number.value = slider.value;
      updateChannel(label, slider.dataset.channel, slider.value);
    });
    // 数値インプット変更による更新
    number.addEventListener('input', () => {
      let v = parseFloat(number.value);
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);

      if (isNaN(v)) v = min;
      else v = Math.min(max, Math.max(min, v));

      slider.value = v;
      number.value = v;

      updateChannel(label, slider.dataset.channel, slider.value);
    });
    number.addEventListener('wheel', onWheelNum, {passive: false});
  });
}

function updateChannel(label, channel, value){
  const sliders = currentConfig.colorBlocks[label].sliders;
  sliders[channel] = parseFloat(value);
  console.log(`スライダー更新: ${label} ${channel} = ${sliders[channel]}`);
  applyCurrentConfig();
  ++updatePhase;
  prepareAndShowImage(frameIndex, showMode);
}

function onWheelNum(e) {
  e.preventDefault();

  const step = parseFloat(this.step) || 1;
  const min  = this.min !== '' ? parseFloat(this.min) : -Infinity;
  const max  = this.max !== '' ? parseFloat(this.max) :  Infinity;
  let   val  = parseFloat(this.value) || 0;

  val += e.deltaY < 0 ? step: -step;
  val = Math.min(max, Math.max(min, val));
  this.value = val.toFixed(getDecimalPlaces(step));

  this.dispatchEvent(new Event('input'));
}

function getDecimalPlaces(num) {
  const s = num.toString().split('.');
  return s[1] ? s[1].length : 0;
}

// カラーピッカーの処理
function setupColorPickerListeners(container, label) {
  const picker = container.querySelector('.color-picker');
  picker.addEventListener('input', () => {
    currentConfig.colorBlocks[label].color = picker.value;
    console.log(`カラーピッカー更新: ${label} = ${currentConfig.colorBlocks[label].color}`);
    applyCurrentConfig();
    ++updatePhase;
    prepareAndShowImage(frameIndex, showMode);
  });
  const arrow = picker.nextElementSibling;
  const labelPicker = arrow.nextElementSibling;
  labelPicker.addEventListener('input', () => {
    currentConfig.colorBlocks[label].labelColor = labelPicker.value;
    console.log(`カラーピッカー更新: ${label} = ${currentConfig.colorBlocks[label].labelColor}`);
    applyCurrentConfig();
    ++updatePhase;
    prepareAndShowImage(frameIndex, showMode);
  });
}

function applyCurrentConfig(){ // currentConfig を globalConfig/frameConfigs に適応
  const strCfg = JSON.parse(JSON.stringify(currentConfig));
  if(cfgToggleStates.some(Boolean)){
    for(let i = 0; i < cfgToggleStates.length; ++i){
      if(cfgToggleStates[i]) {
        frameConfigs[i] = strCfg;
        frameBtns[i].cbtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
      }
    }
  } else {
    globalConfig = strCfg;
  }
}

function applyCurrentDrawing(){
  drawImages[frameIndex] = dctx.getImageData(0, 0, canvas.width, canvas.height);
  frameBtns[frameIndex].dbtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
  if(processedImages[showMode]?.[frameIndex]) processedImages[showMode][frameIndex].phase -= 1;
}

menuContent.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});
menuContent.addEventListener("mousedown", (event) => {
  if(event.button == 2){
    cfgToggleStates.fill(false);
    updateCfgBtns();
  }
});

// dragoverイベントでdrop許可
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

// 画像アップロード / ボタン初期設定
let buttonIsPressed = false;
let fileInfos = null;
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");

  fileInfos = Array.from(e.dataTransfer.files)
  .filter(f => {
    return f.type.startsWith("image/") || f.name.endsWith(".tga") || f.name.endsWith(".tif");
  })
  .map(f => {
    const baseNameOnly = f.name.replace(/\.[^/.]+$/, ""); // 拡張子を除去
    const lastUnderscore = baseNameOnly.lastIndexOf("_");
    const basename = lastUnderscore !== -1 
      ? baseNameOnly.substring(0, lastUnderscore) 
      : baseNameOnly;

    const m = f.name.match(/(\d{4})/);
    const padded = m ? m[1] : "";
    const num = m ? parseInt(m[1], 10) : Infinity;

    return { file: f, padded, num, basename };
  })
  .sort((a, b) => a.num - b.num);

  fileNameInput.value = fileInfos[0].basename;
  fileNameInput.dispatchEvent(new Event('input'));

  menuContent.innerHTML = '';
  frameBtns.length = 0;
  frameIndex = 0;
  cfgToggleStates.length = 0;
  frameConfigs.length = 0;
  uploadedImages = new Array(fileInfos.length);
  drawImages = new Array(fileInfos.length);
  processedImages = { pressure: new Array(fileInfos.length), log: new Array(fileInfos.length), processed: new Array(fileInfos.length) };
  
  // 各ボタンの初期設定
  fileInfos.forEach((info, index) => {
    const row = document.createElement("div");
    row.className = "button-row";
    //// フレームボタン 'rgba(84, 106, 233, 1)'
    const fbtn = document.createElement("button");
    fbtn.classList.add("frame-btn");
    fbtn.style.backgroundColor = 'rgba(233, 84, 109, 1)';
    fbtn.textContent = `${info.padded}`;
    fbtn.addEventListener("mousedown", async (event) => {
      buttonIsPressed |= event.button == 0 ? 1 : 0;
      fbtn.classList.add('active');
      frameIndex = index;
      await prepareAndShowImage(index, showMode);
      // frameIndexのボタンを強調表示
      updateFrmBtns(index);
    });
    fbtn.addEventListener("mouseenter", async () => {
      if(buttonIsPressed) {
        fbtn.classList.add('active');
        frameIndex = index;
        await prepareAndShowImage(index, showMode);
        // frameIndexのボタンを強調表示
        updateFrmBtns(index);
        if(cfgIsPressed){
          cfgToggleStates.fill(false);
          for(let i = Math.min(index, frameCfgIndex); i <= Math.max(index, frameCfgIndex); i++){
            cfgToggleStates[i] = true;
          }
          updateCfgBtns();
        }
      }
      // プレビュー
      const imgData = uploadedImages[index];
      if (!imgData) return;
      const bitmap = await createImageBitmap(imgData);
      const h = 150;
      const w = Math.round(bitmap.width * (h / bitmap.height));
      if(previewCanvas.width != w || previewCanvas.height != h){
        previewCanvas.width  = w;
        previewCanvas.height = h;
      }
      pctx.clearRect(0, 0, w, h);
      pctx.drawImage(bitmap, 0, 0, w, h);
      previewCanvas.style.display = 'block';
    });
    fbtn.addEventListener('mouseleave', () => {
      fbtn.classList.remove('active');
      previewCanvas.style.display = 'none';
    });
    row.appendChild(fbtn);

    // drawingボタン 'rgba(230, 129, 71, 1)'
    const dbtn = document.createElement("button");
    dbtn.classList.add("draw-btn");
    dbtn.innerHTML = '';
    dbtn.addEventListener("mousedown", (event) => {
      buttonIsPressed |= event.button == 0 ? 1 : 0;
      dbtn.classList.add('active');
      frameIndex = index;
    });
    dbtn.addEventListener("mouseenter", (event) => {
      if(buttonIsPressed) {
        frameIndex = index;
      }
    });
    dbtn.addEventListener('mouseup', () => {
      dbtn.classList.remove('active');
    });
    dbtn.addEventListener('mouseleave', () => {
      dbtn.classList.remove('active');
    });
    row.appendChild(dbtn);

    // コンフィグボタン 'rgba(230, 129, 71, 1)'
    const cbtn = document.createElement("button");
    cfgToggleStates[index] = false;
    cbtn.classList.add("config-btn");
    cbtn.innerHTML = '';
    cbtn.addEventListener("mousedown", (event) => {
      cfgIsPressed |= event.button == 0 ? 1 : 0;
      cbtn.classList.add('active');
      if(event.shiftKey) {
        cfgToggleStates.fill(false);
        for(let i = Math.min(index, frameCfgIndex); i <= Math.max(index, frameCfgIndex); i++){
          cfgToggleStates[i] = true;
        }
      }
      else if(event.ctrlKey) {
        cfgToggleStates[index] = !cfgToggleStates[index];
        frameCfgIndex = index;
      }
      else {
        cfgToggleStates.fill(false);
        cfgToggleStates[index] = true;
        frameCfgIndex = index;
      }
      updateCfgBtns();
    });
    cbtn.addEventListener("mouseenter", (event) => {
      if(cfgIsPressed) {
        if(!event.ctrlKey) cfgToggleStates.fill(false);
        for(let i = Math.min(index, frameCfgIndex); i <= Math.max(index, frameCfgIndex); i++){
          cfgToggleStates[i] = true;
        }
        updateCfgBtns();
      }
    });
    cbtn.addEventListener('mouseup', () => {
      cbtn.classList.remove('active');
    });
    cbtn.addEventListener('mouseleave', () => {
      cbtn.classList.remove('active');
    });
    row.appendChild(cbtn);
    frameBtns.push({fbtn:fbtn, dbtn:dbtn, cbtn:cbtn});
    menuContent.appendChild(row);

    const ext = info.file.name.split('.').pop().toLowerCase();

    // Unified loader: obtain ImageData from file (TGA/TIFF/other) then draw to canvas & cache
    (async () => {
      try {
        let imgData;
        if (ext === 'tga') {
          imgData = await loadTGA(info.file);
        } else if (ext === 'tif' || ext === 'tiff') {
          imgData = await loadTIFF(info.file);
        } else {
          imgData = await loadIMG(info.file);
        }

        // Ensure canvases match image size before drawing
        canvas.width = imgData.width;
        canvas.height = imgData.height;
        // Ensure the on-screen (layout) size equals the logical pixel size at 1x zoom.
        // This makes "1倍" correspond to 1:1 on the screen.
        canvas.style.width = canvas.width + 'px';
        canvas.style.height = canvas.height + 'px';

        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;

        drawCanvas.width = canvas.width;
        drawCanvas.height = canvas.height;
        drawCanvas.style.width = canvas.width + 'px';
        drawCanvas.style.height = canvas.height + 'px';

        overlayCanvas.width = canvas.width;
        overlayCanvas.height = canvas.height;
        overlayCanvas.style.width = canvas.width + 'px';
        overlayCanvas.style.height = canvas.height + 'px';

        // Draw ImageData to visible canvas and cache using getImageData as requested
        ctx.putImageData(imgData, 0, 0);
        uploadedImages[index] = ctx.getImageData(0, 0, canvas.width, canvas.height);

        initCanvas(ext.toUpperCase(), index, fileInfos.length);
      } catch (err) {
        console.error('Error loading image file:', err);
        showStatus(`画像の読み込みに失敗しました: ${info.file.name}`, 'error', 3000);
      }
    })();
  });
  ++updatePhase;
  updateFrmBtns(0);

  // 最初の文言を削除
  const h1 = editorContent.querySelector('h1');
  const p = editorContent.querySelector('p');
  if (h1) h1.remove();
  if (p) p.remove();
  editorContent.style.alignItems = 'initial';

  showStatus('画像を読み込み中...', 'info');
});

async function initCanvas(extName, index, fileNum){
  if (index === 0) {
    // Reset transform so 1x shows at 1:1 pixel size on screen
    offsetX = 0;
    offsetY = 0;
    // Use discrete zoom level of 1 (must exist in zoomLevels)
    if (!zoomLevels.includes(1)) {
      zoomLevels.splice(1, 0, 1); // ensure 1 is present near start (safe guard)
    }
    setZoom(1);
    await prepareAndShowImage(0, showMode);
    if (drawImages[frameIndex]){
      dctx.putImageData(drawImages[frameIndex], 0, 0);
    } else {
      dctx.fillStyle = '#FFFFFF';
      dctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    }
  }
  else if (index === fileNum - 1) {
    showStatus(`${extName}画像が読み込まれました。`, 'success', 3000);
  }
}
// フレームボタンの更新
function updateFrmBtns(index){
  frameBtns.forEach((b, i) => {
    if (i === index) {
      b.fbtn.classList.add('accent');
      b.dbtn.classList.add('accent');
    }
    else {
      b.fbtn.classList.remove('accent');
      b.dbtn.classList.remove('accent');
    }
  });
}
// コンフィグボタンの更新
function updateCfgBtns(){
  let noActive = true;
  frameBtns.forEach((b, i) => {
    if (cfgToggleStates[i]) {
      b.cbtn.classList.add('accent');
      noActive = false;
    }
    else {
      b.cbtn.classList.remove('accent');
    }
  });
  if (noActive) {
    colorEditorTitle.innerHTML = 'カラー編集 ⇒ <i class="fa-solid fa-globe"></i> グローバルコンフィグ';
    colorEditorMode = 'global';
    updateColorBlocks(globalConfig);
  } else {
    colorEditorTitle.innerHTML = 'カラー編集 ⇒ <i class="fa-regular fa-images"></i> フレームコンフィグ';
    colorEditorMode = 'frames';
    updateColorBlocks(frameConfigs[frameCfgIndex]);
  }
}

document.addEventListener('mousedown', (event) => {
  if (event.button === 0) 
    buttonIsPressed = true;
});

// プレビューキャンバス移動
document.addEventListener('mousemove', e => {
  if (previewCanvas.style.display === 'none') return;
  // キャンバス幅／高さを読んで左にオフセット
  const cw = previewCanvas.width;
  const ch = previewCanvas.height;
  // マウスの左側に表示、上辺をカーソルの中央に合わせる
  previewCanvas.style.left = (e.pageX - cw - 10) + 'px';
  previewCanvas.style.top  = (e.pageY - ch/2) + 'px';
});

// Keyboard shortcuts: frames, zoom, showMode toggle
document.addEventListener('keydown', (e) => {
  // Ignore when typing in inputs/textareas
  const activeTag = document.activeElement?.tagName;
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

  const key = e.key;
  const isAlt = e.altKey;
  const isShift = e.shiftKey;

  // Frame decrement: '<' or ','  (support both '<' and ',' for different layouts)
  if ((key === '<' || key === ',') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (isAlt) {
      // Go to first frame
      if (uploadedImages.length) {
        frameIndex = 0;
        prepareAndShowImage(frameIndex, showMode);
        updateFrmBtns(frameIndex);
      }
    } else {
      // Decrement current frame
      if (uploadedImages.length) {
        frameIndex = Math.max(0, frameIndex - 1);
        prepareAndShowImage(frameIndex, showMode);
        updateFrmBtns(frameIndex);
      }
    }
    return;
  }

  // Frame increment: '>' or '.'
  if ((key === '>' || key === '.') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (isAlt) {
      // Go to last frame
      if (uploadedImages.length) {
        frameIndex = uploadedImages.length - 1;
        prepareAndShowImage(frameIndex, showMode);
        updateFrmBtns(frameIndex);
      }
    } else {
      // Increment current frame
      if (uploadedImages.length) {
        frameIndex = Math.min(uploadedImages.length - 1, frameIndex + 1);
        prepareAndShowImage(frameIndex, showMode);
        updateFrmBtns(frameIndex);
      }
    }
    return;
  }

  // Zoom: 'z' (zoom in), 'Shift+z' (zoom out)
  if (key.toLowerCase() === 'z' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    const containerRect = editorContent.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    if (isShift) changeZoomStep(-1, centerX, centerY);
    else changeZoomStep(1, centerX, centerY);
    return;
  }

  // Toggle showMode: 'q' toggles between 'processed' and 'original'
  if (key.toLowerCase() === 'q' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    showMode = (showMode === 'processed') ? 'original' : 'processed';
    prepareAndShowImage(frameIndex, showMode);
    return;
  }
});

// Ensure the image for index `i` and mode `showMode` is ready, generate it if needed, then display.
// This separates decision/process logic from the raw drawing performed by showImage(imageData).
async function prepareAndShowImage(i, showMode) {
  if (!uploadedImages[i]) return;

  if (showMode === 'original') {
    showImage(uploadedImages[i]);
    return;
  }

  // If the processed image is out-of-date or missing, generate it.
  if (updatePhase != processedImages[showMode][i]?.phase) {
    await processImage(i);
  }

  const procImg = processedImages[showMode][i]?.img;
  if (procImg) {
    showImage(procImg);
  }

  // Update frame button styles based on completeness for this mode
  updateFrameButtonsForMode(showMode);
}

// カメラワーク / 範囲選択処理
let zoom = 1;
// Allowed zoom steps — fixed sequence requested by user (0.5,1,2,3,4,5,...).
const zoomLevels = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

let offsetX = 0, offsetY = 0;
let isDragging = false;
let startX, startY;

canvas.style.transformOrigin = "0 0"; // 左上基準
drawCanvas.style.transformOrigin = "0 0";
overlayCanvas.style.transformOrigin = "0 0";

// Find the index of the closest zoom level for a given zoom value
function findClosestZoomIndex(z) {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < zoomLevels.length; ++i) {
    const d = Math.abs(z - zoomLevels[i]);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

// Set zoom to an exact allowed value and recenter around (centerX, centerY)
// centerX/centerY are coordinates relative to editorContent (client coords minus container left/top)
function setZoom(newZoom, centerX = null, centerY = null) {
  const prevZoom = zoom;
  zoom = newZoom;

  // If center provided, preserve the visual point under center when scaling
  if (centerX !== null && centerY !== null) {
    offsetX = centerX - (centerX - offsetX) * (zoom / prevZoom);
    offsetY = centerY - (centerY - offsetY) * (zoom / prevZoom);
  }

  updateTransform();
}

// Move by discrete zoom step: delta = +1 => zoom in to next larger level, -1 => zoom out
function changeZoomStep(delta, centerX = null, centerY = null) {
  const idx = findClosestZoomIndex(zoom);
  let nextIdx = idx + delta;
  if (nextIdx < 0) nextIdx = 0;
  if (nextIdx >= zoomLevels.length) nextIdx = zoomLevels.length - 1;
  const newZoom = zoomLevels[nextIdx];
  setZoom(newZoom, centerX, centerY);
}

editorContent.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

// 左クリックでドラッグパン
editorContent.addEventListener("mousedown", (e) => {
  if (cursorMode !== 'camera') return;
  if (e.button === 1) { // 中ボタンでリセット
    offsetX = 0;
    offsetY = 0;
    zoom = 1;
    canvas.style.transform = `translate(0px, 0px) scale(1)`;
    drawCanvas.style.transform = `translate(0px, 0px) scale(1)`;
    overlayCanvas.style.transform = `translate(0px, 0px) scale(1)`;
    e.preventDefault();
    return;
  }
  if (e.button === 0) {
    isDragging = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
  }
});

editorContent.addEventListener("mousemove", (e) => {
  if (cursorMode !== 'camera' || !isDragging) return;
  offsetX = e.clientX - startX;
  offsetY = e.clientY - startY;
  updateTransform();
});

editorContent.addEventListener("mouseup", () => {
  if (cursorMode !== 'camera') return;
  isDragging = false;
});

// 範囲選択
let isLassoing   = false;
let lassoPoints  = [];   // {x,y}
// 投げ縄開始
editorContent.addEventListener('mousedown', e => {
  if (cursorMode !== 'highTh' && cursorMode !== 'lowTh') return;

  isLassoing  = true;
  lassoPoints = [ screenToCanvas(e.clientX, e.clientY) ];
  
  // overlay をクリアしてパスをリセット
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
});

// マウス移動でパスを追加＆プレビュー描画
editorContent.addEventListener('mousemove', e => {
  if (!isLassoing) return;

  lassoPoints.push( screenToCanvas(e.clientX, e.clientY) );
  drawLassoOverlay();
});

// 投げ縄確定（塗りつぶし）
editorContent.addEventListener('mouseup', e => {
  if (!isLassoing) return;
  isLassoing = false;

  let fillMode;
  if(e.button === 0)
    fillMode = 'fill';
  else if(e.button === 2)
    fillMode = 'erase';
  fillLassoRegion(fillMode);
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
});

function drawLassoOverlay() {
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (lassoPoints.length < 2) return;

  octx.save();
  octx.lineWidth   = 2 / zoom;              // ズーム補正
  octx.strokeStyle = 'rgba(0,0,0,0.8)';
  octx.beginPath();
  
  // Path をたどる
  octx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
  for (let i = 1; i < lassoPoints.length; i++) {
    const pt = lassoPoints[i];
    octx.lineTo(pt.x, pt.y);
  }
  octx.stroke();
  octx.restore();
}

function fillLassoRegion(mode = 'fill') {
  if (lassoPoints.length < 3) return;
 
  // Path2D を使うと便利
  const path = new Path2D();
  path.moveTo(lassoPoints[0].x, lassoPoints[0].y);
  for (let i = 1; i < lassoPoints.length; i++) {
    path.lineTo(lassoPoints[i].x, lassoPoints[i].y);
  }
  path.closePath();
 
  let fillColor;
  if (mode == 'fill') {
    fillColor = cursorMode == 'highTh' ? 'rgb(255, 0, 0, 0.1)' : 'rgb(0, 0, 255, 0.1)';
  } else if (mode == 'erase') {
    fillColor = 'rgb(255, 255, 255, 1.0)';
  } else {
    fillColor = 'rgb(255, 255, 255, 1.0)';
  }
 
  // drawCanvas に塗りつぶし
  dctx.save();
  dctx.fillStyle = fillColor;
  dctx.fill(path);
  dctx.restore();
  applyCurrentDrawing();
 
  prepareAndShowImage(frameIndex, showMode);
}


editorContent.addEventListener("wheel", (e) => {
  e.preventDefault();
  // Use discrete zoom steps defined in zoomLevels, snapping to the next/previous level.
  const containerRect = editorContent.getBoundingClientRect();
  const mouseX = e.clientX - containerRect.left;
  const mouseY = e.clientY - containerRect.top;

  if (e.deltaY < 0) {
    changeZoomStep(1, mouseX, mouseY);
  } else {
    changeZoomStep(-1, mouseX, mouseY);
  }
}, { passive: false });

function updateTransform() {
  canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  drawCanvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  overlayCanvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  if(zoom >= 1.0) {
    canvas.style.imageRendering = 'pixelated';
    drawCanvas.style.imageRendering = 'pixelated';
    overlayCanvas.style.imageRendering = 'pixelated';
  }
  else {
    canvas.style.imageRendering = 'auto';
    drawCanvas.style.imageRendering = 'auto';
    overlayCanvas.style.imageRendering = 'auto';
  }
}

function screenToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

initWebGPU();

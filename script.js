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

let showMode = 'processed';
let updatePhase = 0;
let frameIndex = 0;
let frameCfgIndex = 0;
let cfgToggleStates = []; // コンフィグボタンのトグル状態
let cfgIsPressed = false;
let drwToggleStates = []; // drawボタンのトグル状態

// colorBlock ... label(色の名前): { color: 色の値, sliders: {} }
let currentConfig = { bgColor: '#ffffff', colorBlocks: {} }; 
let globalConfig = null;
let frameConfigs = []; // フレームコンフィグ
const frameBtns = []; // フレームボタン用

let uploadedImages = []; // アップロードした画像の保持
let drawImages = []; // マーキング画像の保持
let processedImages = { pressure: [], log: [], processed: [] }; // 処理後画像の保持

let cursorMode = 'camera';
const modeList = { 'デフォルト':'camera', '閾値上げ':'highTh', '閾値下げ':'lowTh' };

function changeShowMode(mode) {
  showMode = mode;
  showImage(frameIndex);
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
    await showImage(i);
  }
  await showImage(frameIndex);
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
        currentConfig = JSON.parse(e.target.result);
        applyCurrentConfig();
        updateConfig();
        ++updatePhase;
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
  
  createColorBlock('#000000', '#000000');
  createColorBlock('#ff0000', '#ff0000');
  createColorBlock('#00ff00', '#00ff00');
  createColorBlock('#0000ff', '#0000ff');
  
  bgPicker.addEventListener('input', () => {
    currentConfig.bgColor = bgPicker.value;
    console.log(`カラーピッカー更新: 背景 = ${currentConfig.bgColor}`);
    applyCurrentConfig();
    ++updatePhase;
    showImage(frameIndex);
  });

  loadLocalConfig();
});

// 新しいカラーブロック要素を作成
function createColorBlock(initialLabelColor, initialColor) {
  const colorBlockSize = Object.keys(currentConfig.colorBlocks).length;
  const container = document.querySelector('.color-content');
  if(colorBlockSize != 0 && container.lastElementChild.id == 'addColorBtn') container.lastElementChild.remove();

  let html = `
    <div class="color-block" data-label="${colorBlockSize}">
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

  container.lastElementChild.addEventListener('click', () => {
    createColorBlock('#000000', '#000000');
  });

  const sliders = { threshold: 0.5, log:0, weight:1 };
  currentConfig.colorBlocks[colorBlockSize] = { color: initialColor, labelColor: initialLabelColor, sliders: sliders };
  applyCurrentConfig();

  // イベントをバインド
  const block = container.querySelector(`.color-block[data-label="${colorBlockSize}"]`);
  setupSliderListeners(block, colorBlockSize);
  setupColorPickerListeners(block, colorBlockSize);
}

const defaultSliderValue = { threshold: 0, log: 0, weight: 0 };
const gValueRanges = { threshold: [0, 1], log: [0, 10], weight: [0, 10] };
const fValueRanges = { threshold: [-0.2, 0.2], log: [-2, 2], weight: [-2, 2] };
let colorEditorMode = 'global';
let pColorEditorMode = colorEditorMode;
function updateColorBlocks(cfg){ // カラーブロック値を更新
  const colorCfg = cfg ? cfg : globalConfig;
  const sliderCfg = cfg;
  const keys = Object.keys(currentConfig.colorBlocks);
  currentConfig.bgColor = colorCfg.bgColor;
  for(let i = 0; i < keys.length; ++i){ // 黒,赤,緑,青,...
    currentConfig.colorBlocks[keys[i]].color = colorCfg.colorBlocks[keys[i]].color;
    currentConfig.colorBlocks[keys[i]].labelColor = colorCfg.colorBlocks[keys[i]].labelColor;
    currentConfig.colorBlocks[keys[i]].sliders = sliderCfg ? { ...sliderCfg.colorBlocks[keys[i]].sliders } : { ...defaultSliderValue };
  }
  updateConfig();
  pColorEditorMode = colorEditorMode;
}

// currentConfig に表示中の値を代入 bgColor, colorBlks{col, lcol, sliders{...}}
function updateConfig(){
  if (currentConfig.bgColor) {
    if (bgPicker) bgPicker.value = currentConfig.bgColor;
  }
  if (currentConfig.colorBlocks) {
    for (const [label, colorBlock] of Object.entries(currentConfig.colorBlocks)) {
      currentConfig.colorBlocks[label].color = colorBlock.color;
      const picker = document.querySelector(`.color-block[data-label="${label}"] .color-picker`);
      if (picker) picker.value = colorBlock.color;
      
      currentConfig.colorBlocks[label].labelColor = colorBlock.labelColor;
      const arrow = picker.nextElementSibling;
      const labelPicker = arrow.nextElementSibling;
      if (labelPicker) labelPicker.value = colorBlock.labelColor;
      if (colorBlock.sliders) {
        for (const [param, value] of Object.entries(colorBlock.sliders)) { // param ... th, log, wei | value ... 0.5, 0, 1.0
          currentConfig.colorBlocks[label].sliders[param] = value;
          const slider = document.querySelector(`.color-block[data-label="${label}"] .color-slider[data-channel="${param}"]`);
          const number = slider?.parentElement.querySelector('.slider-value');
          if (colorEditorMode != pColorEditorMode) {
            const ranges = colorEditorMode == 'global' ? gValueRanges : fValueRanges;
            slider.min = ranges[param][0];
            slider.max = ranges[param][1];
            number.min = ranges[param][0];
            number.max = ranges[param][1];
          }
          slider.value = value;
          number.value = value;
        }
      }
    }
  }
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
  showImage(frameIndex);
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
    showImage(frameIndex);
  });
  const arrow = picker.nextElementSibling;
  const labelPicker = arrow.nextElementSibling;
  labelPicker.addEventListener('input', () => {
    currentConfig.colorBlocks[label].labelColor = labelPicker.value;
    console.log(`カラーピッカー更新: ${label} = ${currentConfig.colorBlocks[label].labelColor}`);
    applyCurrentConfig();
    ++updatePhase;
    showImage(frameIndex);
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
  const drw = dctx.getImageData(0, 0, canvas.width, canvas.height);
  if(drwToggleStates.some(Boolean)){
    for(let i = 0; i < drwToggleStates.length; ++i){
      if(drwToggleStates[i]) {
        drawImages[i] = drw;
        frameBtns[i].dbtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
        if(processedImages[showMode]?.[i]) processedImages[showMode][i].phase -= 1;
      }
    }
  }
}

//// HTML要素の処理
const menuContent = document.querySelector(".menu-content");
const editorContent = document.querySelector(".editor-content");
editorContent.innerHTML = `
  <h1>編集画面</h1>
  <p>ここに画像をドラッグ＆ドロップしてください</p>
  <canvas id="canvas"></canvas>
  <canvas id="drawCanvas"></canvas>
  <canvas id="overlayCanvas"></canvas>
`;
const colorEditorTitle = document.getElementById("color-editor-title");
// コンフィグのドロップゾーン
const dropZone = document.getElementById("drop-zone");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const offscreenCanvas = document.createElement("canvas");
const osctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
offscreenCanvas.style.position = 'absolute';
offscreenCanvas.style.visibility = 'hidden';
editorContent.appendChild(offscreenCanvas);
const drawCanvas = document.getElementById("drawCanvas");
const dctx = drawCanvas.getContext('2d', { willReadFrequently: true });
const overlayCanvas = document.getElementById("overlayCanvas");
const octx = overlayCanvas.getContext('2d');
// ボタンとプレビュー用 canvas を取得
const buttons = document.querySelectorAll('.preview-btn');
const previewCanvas = document.getElementById('previewCanvas');
const pctx = previewCanvas.getContext('2d');
// 背景カラーピッカー
const bgPicker = document.querySelector('input[type="color"][data-label="bgColorPicker"]');

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
  drwToggleStates.length = 0;
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
      await showImage(index);
      // frameIndexのボタンを強調表示
      updateFrmBtns(index);
      drwToggleStates.fill(false);
      for(let i = Math.min(index, frameIndex); i <= Math.max(index, frameIndex); i++){
        drwToggleStates[i] = true;
      }
      updateDrwBtns();
    });
    fbtn.addEventListener("mouseenter", async () => {
      if(buttonIsPressed) {
        fbtn.classList.add('active');
        frameIndex = index;
        drwToggleStates.fill(false);
        drwToggleStates[index] = true;
        await showImage(index);
        // frameIndexのボタンを強調表示
        updateFrmBtns(index);
        updateDrwBtns();
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
    drwToggleStates[index] = index == 0;
    dbtn.classList.add("draw-btn");
    dbtn.innerHTML = '';
    dbtn.addEventListener("mousedown", (event) => {
      buttonIsPressed |= event.button == 0 ? 1 : 0;
      dbtn.classList.add('active');
      if(event.shiftKey) {
        drwToggleStates.fill(false);
        for(let i = Math.min(index, frameIndex); i <= Math.max(index, frameIndex); i++){
          drwToggleStates[i] = true;
        }
      }
      else if(event.ctrlKey) {
        drwToggleStates[index] = !drwToggleStates[index];
        frameIndex = index;
      }
      else {
        drwToggleStates.fill(false);
        drwToggleStates[index] = true;
        frameIndex = index;
      }
      updateDrwBtns();
    });
    dbtn.addEventListener("mouseenter", (event) => {
      if(buttonIsPressed) {
        if(!event.ctrlKey) drwToggleStates.fill(false);
        for(let i = Math.min(index, frameIndex); i <= Math.max(index, frameIndex); i++){
          drwToggleStates[i] = true;
        }
        updateDrwBtns();
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
    if (ext === 'tga') {
      loadTGA(info.file, index, fileInfos.length);
    } else if (ext === 'tif' || ext === 'tiff') {
      loadTIFF(info.file, index, fileInfos.length);
    } else {
      // 既存処理 (PNG/JPGなどブラウザ対応画像)
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = async () => {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          console.log(`Width: ${canvas.width}, Height: ${canvas.height}`);

          offscreenCanvas.width = canvas.width;
          offscreenCanvas.height = canvas.height;
          ctx.drawImage(img, 0, 0);
          uploadedImages[index] = ctx.getImageData(0, 0, canvas.width, canvas.height);
          initCanvas('', index, fileNum);
        };
      };
      reader.readAsDataURL(info.file);
    }
  });
  ++updatePhase;
  updateFrmBtns(0);
  updateDrwBtns();

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
    await showImage(0);
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
    if (i === index) b.fbtn.classList.add('accent');
    else b.fbtn.classList.remove('accent');
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
// 描画編集ボタンの更新
function updateDrwBtns(){
  let noActive = true;
  frameBtns.forEach((b, i) => {
    if (drwToggleStates[i]) {
      b.dbtn.classList.add('accent');
      noActive = false;
    }
    else {
      b.dbtn.classList.remove('accent');
    }
  });
  if (noActive) {
    // 全drawボタンが非アクティブの時
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

// カメラワーク / 範囲選択処理
let zoom = 1;
let offsetX = 0, offsetY = 0;
let isDragging = false;
let startX, startY;

canvas.style.transformOrigin = "0 0"; // 左上基準
drawCanvas.style.transformOrigin = "0 0";
overlayCanvas.style.transformOrigin = "0 0";

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

  showImage(frameIndex);
}


editorContent.addEventListener("wheel", (e) => {
  e.preventDefault();

  const zoomFactor = 1.1;
  const prevZoom = zoom;

  // 拡縮
  if (e.deltaY < 0) {
    zoom *= zoomFactor;
  } else {
    zoom /= zoomFactor;
  }

  // editorContent基準のマウス座標を取得
  const containerRect = editorContent.getBoundingClientRect();
  const mouseX = e.clientX - containerRect.left;
  const mouseY = e.clientY - containerRect.top;

  // ズーム補正
  offsetX = mouseX - (mouseX - offsetX) * (zoom / prevZoom);
  offsetY = mouseY - (mouseY - offsetY) * (zoom / prevZoom);

  updateTransform();
}, { passive: false });

function updateTransform() {
  canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  drawCanvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  overlayCanvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  if(zoom > 1.0) {
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

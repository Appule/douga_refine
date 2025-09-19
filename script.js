// --- ユーザーインターフェース関連処理 ---
// ステータス出力
function showStatus(message, type = 'info', duration = null) {
  const statusElement = document.getElementById('status')
  statusElement.innerHTML = `<div class="${type}">${message}</div>`;

  if (duration > 0) {
    setTimeout(() => {
      statusElement.innerHTML = '';
    }, duration);
  }
}

let topZIndex = 100;
// --- ParamsWindow Class ---
class ParamsWindow {
  /**
   * @param {string} id - DOMのID
   * @param {string} backgroundColor - CSSの色指定 (例: 'rgba(255, 200, 200, 0.9)')
   */
  constructor(id, backgroundColor = 'rgba(255, 255, 255, 0.52)') {
    this.windowIsClicked = false;
    
    this.el = document.getElementById(id);

    this.container = document.createElement('div');
    this.container.className = 'scroll-container';
    this.el.appendChild(this.container);
    this.el.style.backgroundColor = backgroundColor;

    this.el.addEventListener('mousedown', () => {
      topZIndex++;
      this.el.style.zIndex = topZIndex;
    });
    this.el.addEventListener('mouseleave', () => {
      this.windowIsClicked = false;
    });

    // Draggable
    interact(this.el).draggable({
      inertia: false,
      ignoreFrom: 'input, button, select, textarea',
      modifiers: [
        interact.modifiers.restrictRect({
          restriction: 'parent',
          endOnly: true
        })
      ],
      listeners: {
        move(event) {
          const target = event.target;
          const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
          const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
          target.style.transform = `translate(${x}px, ${y}px)`;
          target.setAttribute('data-x', x);
          target.setAttribute('data-y', y);
        }
      }
    });

    // Resizable
    interact(this.el).resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      listeners: {
        move(event) {
          const target = event.target;

          let { width, height } = event.rect;
          target.style.width = `${width - 24}px`;
          target.style.height = `${height - 24}px`;
          let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.deltaRect.left;
          let y = (parseFloat(target.getAttribute('data-y')) || 0) + event.deltaRect.top;

          target.style.transform = `translate(${x}px, ${y}px)`;
          target.setAttribute('data-x', x);
          target.setAttribute('data-y', y);
        }
      },
      modifiers: [
        interact.modifiers.restrictSize({
          min: { width: 150, height: 100 },
          max: { width: 600, height: 600 }
        })
      ],
      inertia: true
    });
  }

  show() {
    this.el.style.display = 'block';
  }
  hide() {
    this.el.style.display = 'none';
  }
  toggle(visible) {
    this.el.style.display = visible ? 'block' : 'none';
  }
  
  // Add Slider
  addSlider(label, min, max, value, step, onChange, sliderColor = '#009ddb') {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '8px';

    const labelEl = document.createElement('label');
    labelEl.textContent = `${label}: `;
    wrapper.appendChild(labelEl);

    const valueEl = document.createElement('span');
    valueEl.textContent = value;
    wrapper.appendChild(valueEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.style.width = '100%';
    slider.style.accentColor = sliderColor;
    slider.addEventListener('input', () => {
      valueEl.textContent = slider.value;
      if (typeof onChange === 'function') onChange(parseFloat(slider.value));
    });

    wrapper.appendChild(slider);
    this.container.appendChild(wrapper);

    return slider;
  }

  // Add Button
  addButton(label, onClick, draggable = false, color = 'rgb(92, 92, 92)') {
    const btn = document.createElement('button');
    btn.innerHTML = `${label}`;
    btn.style.display = 'block';
    btn.style.marginTop = '2px';
    btn.style.width = '160px';
    btn.style.backgroundColor = color;
    btn.style.border = "none";
    btn.style.padding = "6px";
    btn.style.fontSize = "14px";
    btn.style.color = 'white';

    btn.addEventListener('click', () => {
      if (typeof onClick === 'function') onClick();
    });
    btn.addEventListener('mousedown', (event) => {
      this.windowIsClicked |= event.button == 0 ? 1 : 0;
      btn.classList.add('active');
    });
    btn.addEventListener('mouseup', (event) => {
      this.windowIsClicked &= event.button == 0 ? 0 : 1;
      btn.classList.remove('active');
    });
    btn.addEventListener("mouseenter", () => {
      if(typeof onClick === 'function' && draggable && this.windowIsClicked) {
        btn.classList.add('active');
        onClick();
      }
    });
    btn.addEventListener('mouseleave', () => {
      btn.classList.remove('active');
    });
    this.container.appendChild(btn);

    return btn;
  }

  // Add Text Input
  addTextInput(label, onChange){
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '8px';

    const labelEl = document.createElement('label');
    labelEl.textContent = `${label}: `;
    wrapper.appendChild(labelEl);

    const input = document.createElement('input');

    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.marginTop = '4px';
    
    input.addEventListener('input', () => {
      onChange(input.value);
    });

    wrapper.appendChild(input);
    this.container.appendChild(wrapper);

    // save to inputs
    if (!this.inputs) this.inputs = {};
    this.inputs[label] = input;

    return input;
  }

  // Add Number Input
  addNumberInput(label, value, min, max, step, onChange){
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '8px';

    const labelEl = document.createElement('label');
    labelEl.textContent = `${label}: `;
    wrapper.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;

    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.marginTop = '4px';
    
    input.addEventListener('wheel', (e) => {
      e.preventDefault();
      let current = parseFloat(input.value) || 0;
      let s = parseFloat(input.step) || 1;

      let min = input.min !== '' ? parseFloat(input.min) : undefined;
      let max = input.max !== '' ? parseFloat(input.max) : undefined;

      if (e.deltaY < 0) current += s;
      else current -= s;

      if (min !== undefined) current = Math.max(current, min);
      if (max !== undefined) current = Math.min(current, max);

      input.value = current;
      if (typeof onChange === 'function') onChange(current);
    });

    input.addEventListener('input', () => {
      const num = parseFloat(input.value);
      if (!isNaN(num) && typeof onChange === 'function') {
        onChange(num);
      }
    });

    wrapper.appendChild(input);
    this.container.appendChild(wrapper);

    // save to inputs
    if (!this.inputs) this.inputs = {};
    this.inputs[label] = input;

    return input;
  }

  // Add Dropdown
  addDropdown(label, options = [], onChange, color = 'rgba(92, 92, 92, 1)') {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'block';
    wrapper.style.marginTop = '2px';
    wrapper.style.width = '160px';

    // ラベル
    const span = document.createElement('span');
    span.textContent = label;
    span.style.display = 'block';
    span.style.fontSize = '14px';
    span.style.marginBottom = '2px';
    wrapper.appendChild(span);

    // セレクトボックス
    const select = document.createElement('select');
    select.style.width = '100%';
    select.style.padding = '6px';
    select.style.border = 'none';
    select.style.backgroundColor = color;
    select.style.color = 'white';
    select.style.fontSize = '14px';
    select.style.cursor = 'pointer';

    // 選択肢を追加
    options.forEach(opt => {
      const option = document.createElement('option');
      if (typeof opt === 'string') {
        option.value = opt;
        option.textContent = opt;
      } else {
        // { value: 'val', text: '表示名' } 形式もサポート
        option.value = opt.value;
        option.textContent = opt.text;
      }
      select.appendChild(option);
    });

    // イベント
    select.addEventListener('change', () => {
      if (typeof onChange === 'function') onChange(select.value);
    });

    wrapper.appendChild(select);
    this.container.appendChild(wrapper);

    return select;
  }

  addFileInput(id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = id;
    input.multiple = true;

    // ボタン風のスタイルを直接当てる
    input.style.display = "block";
    input.style.marginTop = "2px";
    input.style.width = "160px";
    input.style.fontSize = "14px";
    input.style.color = "black";

    // ブラウザ対応できる範囲で擬似ボタンを統一
    input.style.cssText += `
      &::file-selector-button {
        background: rgb(92, 92, 92);
        border: none;
        padding: 6px;
        font-size: 14px;
        color: black;
        cursor: pointer;
      }
      &::file-selector-button:hover {
        background: rgb(72, 72, 72);
      }
      &::file-selector-button:active {
        background: rgb(52, 52, 52);
      }
    `;

    this.container.appendChild(input);

    return input;
  }
}

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
let currentConfig = {bgColor: '#ffffff', colorBlocks: {}}; 
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

// Canvas ImageData → TIFF Blob
function encodeTIFF(imgData) {
  // RGBA をそのまま Uint8Array で取得
  const rgba = new Uint8Array(imgData.data);

  // UTIF.encodeImage は RGBA配列・幅・高さを受け取る
  const tiffBuffer = UTIF.encodeImage(
    rgba,
    imgData.width,
    imgData.height,
    {
      t258: [8, 8, 8, 8], // BitsPerSample
      t259: [1],          // Compression
      t262: [2],          // PhotometricInterpretation
      t277: [4],          // SamplesPerPixel
    }
  );

  return new Blob([tiffBuffer], { type: "image/tiff" });
}

// Canvas ImageData → TGA Blob (RGB)
function encodeTGA(imgData) {
  const w = imgData.width;
  const h = imgData.height;
  const pixels = imgData.data;
  const header = new Uint8Array(18);

  header[2] = 10;               // type10: RLE truecolor
  header[12] = w & 0xFF;
  header[13] = (w >> 8) & 0xFF;
  header[14] = h & 0xFF;
  header[15] = (h >> 8) & 0xFF;
  header[16] = 24;              // 24bit (BGR)
  header[17] = 0x00;            // origin 下左に変更

  const out = [];
  const getPixel = (x, y) => {
    const i = (y * w + x) * 4;
    return [pixels[i + 2], pixels[i + 1], pixels[i]]; // BGR
    // const bk = Math.max(Math.max(pixels[i + 2], pixels[i + 1]), pixels[i]);
    // return [bk, bk, bk]; // only blk
    // return bk == 0 ? [255, 255, 255] : [pixels[i + 2], pixels[i + 1], pixels[i]]; // only BGR
  };

  const pixelEquals = (x1, y1, x2, y2) => {
    const i1 = (y1 * w + x1) * 4;
    const i2 = (y2 * w + x2) * 4;
    return pixels[i1] === pixels[i2] && 
           pixels[i1 + 1] === pixels[i2 + 1] && 
           pixels[i1 + 2] === pixels[i2 + 2];
  };

  // 下から上に処理（TGA標準）
  for (let y = h - 1; y >= 0; y--) {
    let x = 0;
    while (x < w) {
      const startX = x;
      
      // 現在のピクセルから何個連続するかチェック
      let runLength = 1;
      while (x + runLength < w && 
             runLength < 128 && 
             pixelEquals(startX, y, startX + runLength, y)) {
        runLength++;
      }

      if (runLength >= 3) {
        // RLEパケット（3個以上連続する場合のみ）
        out.push(0x80 | (runLength - 1));
        const pixel = getPixel(startX, y);
        out.push(pixel[0], pixel[1], pixel[2]);
        x += runLength;
      } else {
        // RAWパケット
        let rawCount = 1;
        let nextX = x + 1;
        
        // 次に3個以上連続する箇所が出てくるまで、またはパケット上限まで
        while (nextX < w && rawCount < 128) {
          // 現在位置から3個連続チェック
          let consecutiveCount = 1;
          while (nextX + consecutiveCount < w && 
                 consecutiveCount < 3 && 
                 pixelEquals(nextX, y, nextX + consecutiveCount, y)) {
            consecutiveCount++;
          }
          
          // 3個以上連続するなら、RAWパケットを終了
          if (consecutiveCount >= 3) {
            break;
          }
          
          rawCount++;
          nextX++;
        }

        // RAWパケット出力
        out.push(rawCount - 1);
        for (let i = 0; i < rawCount; i++) {
          const pixel = getPixel(x + i, y);
          out.push(pixel[0], pixel[1], pixel[2]);
        }
        x += rawCount;
      }
    }
  }

  const body = new Uint8Array(out);
  return new Blob([header, body], { type: "image/x-tga" });
}

const fileExtList = windows[0].addDropdown('保存形式', ['', 'png', 'tif', 'tga'], () => {}, 'rgb(0, 185, 40)');

async function saveImages() {
  const fileName = fileNameInput.value.trim();
  const fileFormat = fileExtList.value;
  if (fileName === '') {
    alert('ファイル名を入力してください。');
    fileNameInput.classList.add('blink');
    return;
  }
  if (fileFormat === '') {
    alert('ファイル形式を選択してください。');
    return;
  }
  if (processedImages.processed.length === 0) {
    alert('保存する画像がありません。');
    return;
  }
  // 確認ダイアログ
  const ok = confirm(`「${fileName}_XXXX.${fileFormat}」という名前で保存しますか？`);
  if (!ok) {
    return; // キャンセルされたら処理を中止
  }
  // 全処理
  let allProcessed = false;
  for (let j = 0; j < uploadedImages.length; j++) {
    if (!processedImages['processed'][j]?.img || updatePhase != processedImages['processed'][j]?.phase) {
      allProcessed = false;
      break;
    }
    allProcessed = true;
  }
  if(!allProcessed){
    await processAllImages();
  }
  showStatus('ZIPファイルを生成中...', 'info');
  
  const zip = new JSZip();

  for (let i = 0; i < processedImages.processed.length; i++) {
    const imgData = processedImages.processed[i].img;
    if (!imgData) continue;

    canvas.width = imgData.width;
    canvas.height = imgData.height;
    ctx.putImageData(imgData, 0, 0);

    let blob;
    if (fileFormat === 'png') {
      blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    } else if (fileFormat === 'tif') {
      blob = encodeTIFF(imgData);
    } else if (fileFormat === 'tga') {
      blob = encodeTGA(imgData);
    } else {
      throw new Error('Unsupported format: ' + fileFormat);
    }
      
    const base = fileNameInput.value;
    const num  = fileInfos[i].padded;
    const name = `${base}_${num}.${fileFormat}`;

    zip.file(name, blob);
  }
  
  localStorage.setItem("localConfigData", JSON.stringify(globalConfig));
  zip.file("config.json", JSON.stringify(globalConfig, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${fileName}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);

  showStatus('ZIPファイルの保存が完了しました。', 'success', 3000);
}

windows[0].addButton('<i class="fas fa-file-download"></i> 保存', saveImages, false, 'rgb(0, 153, 221)');

// ローカルストレージからコンフィグをロード
function loadLocalConfig() {
  const localConfig = localStorage.getItem("localConfigData");
  if (localConfig) {
    try {
      currentConfig = JSON.parse(localConfig);
      globalConfig = JSON.parse(localConfig);
      updateConfig();
      showStatus('前回のConfigを復元しました。', 'success', 3000);
    } catch (error) {
      console.error('Error loading local config:', error);
      showStatus('前回のConfigの復元に失敗しました。', 'error', 3000);
    }
  }
}

// コンフィグのセーブ (エクスポート)
const exportBtn = document.getElementById('exportColorsBtn');
function saveConfig() {
  localStorage.setItem("localConfigData", JSON.stringify(globalConfig));
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalConfig, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `config.json`);
  dlAnchorElem.click(); 
  showStatus('Configファイルの保存が完了しました。', 'success', 3000);
}
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
  
  createColorBlock('黒', '#000000');
  createColorBlock('赤', '#ff0000');
  createColorBlock('緑', '#00ff00');
  createColorBlock('青', '#0000ff');
    
  const bgPicker = document.querySelector('input[type="color"][data-label="背景"]');
  bgPicker.addEventListener('input', () => {
    bgColor = bgPicker.value;
    console.log(`カラーピッカー更新: 背景 = ${bgColor}`);
    applyCurrentConfig();
    ++updatePhase;
    showImage(frameIndex);
  });

  loadLocalConfig();
});

// 新しいカラーブロック要素を作成
function createColorBlock(label, initialColor) {
  const container = document.querySelector('.color-content');

  let html = `
  <div class="color-block" data-label="${label}">
    <div class="color-control-group">
      <span>${label}</span>
      <input type="color" class="color-picker" value="${initialColor}" data-label="${label}">
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
        <div class="slider-row" style="display: none;">
          <span class="slider-label">幅調整</span>
          <input type="range" class="color-slider" min="-5" max="5" step="0.1" value="0.0" data-channel="gau">
          <input type="number" class="slider-value" min="-5" max="5" step="0.1" value="0.0"/>
        </div>
        <div class="slider-row">
          <span class="slider-label">重み　</span>
          <input type="range" class="color-slider" min="0" max="10" step="0.1" value="1" data-channel="weight">
          <input type="number" class="slider-value" min="0" max="10" step="0.1" value="1.0"/>
        </div>
      </div>
    </div>
  </div>
  `;
  container.insertAdjacentHTML('beforeend', html);

  const sliders = { threshold: 0.5, log:0, gau:0, weight:1 };
  currentConfig.colorBlocks[label] = { color: initialColor, sliders: sliders };
  applyCurrentConfig();

  // イベントをバインド
  const block = container.querySelector(`.color-block[data-label="${label}"]`);
  setupSliderListeners(block, label);
  setupColorPickerListeners(block, label);
}

const defaultSliderValue = { threshold: 0, log: 0, gau: 0, weight: 0 };
const gValueRanges = { threshold: [0, 1], log: [0, 10], gau: [-5, 5], weight: [0, 10] };
const fValueRanges = { threshold: [-0.2, 0.2], log: [-2, 2], gau: [-2, 2], weight: [-2, 2] };
let colorEditorMode = 'global';
let pColorEditorMode = colorEditorMode;
function updateColorBlocks(cfg){ // カラーブロック値を更新
  const colorCfg = cfg ? cfg : globalConfig;
  const sliderCfg = cfg;
  const keys = Object.keys(currentConfig.colorBlocks);
  currentConfig.bgColor = colorCfg.bgColor;
  for(let i = 0; i < keys.length; ++i){ // 黒,赤,緑,青,...
    currentConfig.colorBlocks[keys[i]].color = colorCfg.colorBlocks[keys[i]].color;
    currentConfig.colorBlocks[keys[i]].sliders = sliderCfg ? { ...sliderCfg.colorBlocks[keys[i]].sliders } : { ...defaultSliderValue };
  }
  updateConfig();
  pColorEditorMode = colorEditorMode;
}

function updateConfig(){
  if (currentConfig.bgColor) {
    const bgPicker = document.querySelector('input[type="color"][data-label="背景"]');
    if (bgPicker) bgPicker.value = currentConfig.bgColor;
  }
  if (currentConfig.colorBlocks) {
    for (const [label, colorBlock] of Object.entries(currentConfig.colorBlocks)) {
      currentConfig.colorBlocks[label].color = colorBlock.color;
      const picker = document.querySelector(`.color-block[data-label="${label}"] .color-picker`);
      if (picker) picker.value = colorBlock.color;
      if (colorBlock.sliders) {
        for (const [param, value] of Object.entries(colorBlock.sliders)) { // param...th,log,gau,wei value...0.5,0,0,1.0
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

function updateFrmBtns(index){
  frameBtns.forEach((b, i) => {
    if (i === index) b.fbtn.classList.add('accent');
    else b.fbtn.classList.remove('accent');
  });
}

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
  if (drawImages[frameIndex]){
    dctx.putImageData(drawImages[frameIndex], 0, 0);
  } else {
    dctx.fillStyle = '#FFFFFF';
    dctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
  }
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
  drwToggleStates.length = 0;
  frameConfigs.length = 0;
  uploadedImages = new Array(fileInfos.length);
  drawImages = new Array(fileInfos.length);
  processedImages = { pressure: new Array(fileInfos.length), log: new Array(fileInfos.length), processed: new Array(fileInfos.length) };
  
  // 各ボタンの初期設定
  fileInfos.forEach((info, index) => {
    const isFirst = index == 0;
    const row = document.createElement("div");
    row.className = "button-row";
    //// フレームボタン 'rgba(84, 106, 233, 1)'
    const fbtn = document.createElement("button");
    fbtn.classList.add("frame-btn");
    if(isFirst) fbtn.classList.add('accent');
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
    drwToggleStates[index] = isFirst;
    dbtn.classList.add("draw-btn");
    if(isFirst) dbtn.classList.add('accent');
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

          if (index === 0) await showImage(0);
          else if (index === fileInfos.length - 1)
            showStatus('画像が読み込まれました。処理を実行できます。', 'success', 3000);
        };
      };
      reader.readAsDataURL(info.file);
    }
  });
  ++updatePhase;
  showStatus('画像を読み込み中...', 'info');
});

async function loadTIFF(file, index, fileNum) {
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  UTIF.decodeImages(buffer, ifds);

  const rgba = UTIF.toRGBA8(ifds[0]);
  const width = ifds[0].width;
  const height = ifds[0].height;

  canvas.width = width;
  canvas.height = height;
  offscreenCanvas.width = canvas.width;
  offscreenCanvas.height = canvas.height;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  uploadedImages[index] = ctx.getImageData(0, 0, width, height);

  if (index === 0) await showImage(0);
  else if (index === fileNum - 1)
    showStatus('TIFF画像が読み込まれました。', 'success', 3000);
}

async function loadTGA(file, index, fileNum) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  // --- ヘッダ解析 ---
  const idLength   = view.getUint8(0);
  const colorMap   = view.getUint8(1);
  const imageType  = view.getUint8(2);   // 2 = 非圧縮RGB, 10 = RLE圧縮RGB
  const width      = view.getUint16(12, true);
  const height     = view.getUint16(14, true);
  const depth      = view.getUint8(16);  // 24 or 32
  const descriptor = view.getUint8(17);

  if (imageType !== 2 && imageType !== 10) {
    alert("このTGAは非圧縮RGB(type2)またはRLE圧縮RGB(type10)のみ対応です。");
    return;
  }

  const offset = 18 + idLength; // IDフィールドを飛ばす
  const bytesPerPixel = depth / 8;
  const imageData = new ImageData(width, height);
  const rgba = imageData.data;
  const flipY = !(descriptor & 0x20);

  let src = offset;
  let dst = 0;

  function writePixel(r, g, b, a) {
    const px = dst / 4;
    const x = px % width;
    const y = Math.floor(px / width);
    const row = flipY ? (height - 1 - y) : y;
    const dstIndex = (row * width + x) * 4;
    rgba[dstIndex] = r;
    rgba[dstIndex + 1] = g;
    rgba[dstIndex + 2] = b;
    rgba[dstIndex + 3] = a;
    dst += 4;
  }

  if (imageType === 2) {
    // 非圧縮
    while (dst < width * height * 4) {
      const b = view.getUint8(src++);
      const g = view.getUint8(src++);
      const r = view.getUint8(src++);
      const a = (bytesPerPixel === 4) ? view.getUint8(src++) : 255;
      writePixel(r, g, b, a);
    }
  } else if (imageType === 10) {
    // RLE圧縮
    while (dst < width * height * 4) {
      const header = view.getUint8(src++);
      const count = (header & 0x7F) + 1;

      if (header & 0x80) {
        // RLEパケット
        const b = view.getUint8(src++);
        const g = view.getUint8(src++);
        const r = view.getUint8(src++);
        const a = (bytesPerPixel === 4) ? view.getUint8(src++) : 255;
        for (let i = 0; i < count; i++) {
          writePixel(r, g, b, a);
        }
      } else {
        // RAWパケット
        for (let i = 0; i < count; i++) {
          const b = view.getUint8(src++);
          const g = view.getUint8(src++);
          const r = view.getUint8(src++);
          const a = (bytesPerPixel === 4) ? view.getUint8(src++) : 255;
          writePixel(r, g, b, a);
        }
      }
    }
  }

  // --- canvasに描画 ---
  canvas.width = width;
  canvas.height = height;
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  drawCanvas.width = width;
  drawCanvas.height = height;
  overlayCanvas.width = width;
  overlayCanvas.height = height;
  ctx.putImageData(imageData, 0, 0);

  // --- キャッシュ ---
  uploadedImages[index] = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (index === 0) {
    await showImage(0);
  } else if (index === fileNum - 1) {
    showStatus('TGA画像が読み込まれました。', 'success', 3000);
  }
}

document.addEventListener('mousedown', (event) => {
  if (event.button === 0) 
    buttonIsPressed = true;
});

// カメラワーク/範囲選択処理
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


// --- WebGPUコンピュートシェーダーコード ---
let uniformsCode = '';

function makeUniformsCodes(paramsSize){
  uniformsCode = `
    struct ColorUniform {
      col: vec4<f32>,
      threshold: f32,
      logFac: f32,
      gauFac: f32,
      weight: f32,
    };

    struct Uniforms {
      width: u32,
      height: u32,
      colorNum: u32,
      padding: u32,
      params: array<ColorUniform, ${paramsSize}>,
      whiteCol: vec4<f32>,
    }
  `;
}

const tracePressShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<u32>;
  @group(0) @binding(2) var<storage, read> imageIn2: array<u32>;
  @group(0) @binding(3) var<storage, read_write> imageOutP: array<f32>;
  @group(0) @binding(4) var<storage, read_write> imageOutC: array<u32>;
  // @group(0) @binding(4) var<storage, read_write> imageOutD: array<u32>;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let bgPos = rgb2xyz(uniforms.whiteCol.rgb);
    let samplePallet = array<vec3f, 4>(
      rgb2xyz(uniforms.params[0].col.rgb), // 黒
      rgb2xyz(uniforms.params[1].col.rgb), // 赤
      rgb2xyz(uniforms.params[2].col.rgb), // 緑
      rgb2xyz(uniforms.params[3].col.rgb), // 青
    );
    
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) { return; }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let h = i32(height);
    let index = y * w + x;

    let pixelIn = imageIn[u32(index)];
    var r = f32((pixelIn >> 0u) & 0xFFu) / 255.;
    var g = f32((pixelIn >> 8u) & 0xFFu) / 255.;
    var b = f32((pixelIn >> 16u) & 0xFFu) / 255.;
    let a = f32((pixelIn >> 24u) & 0xFFu) / 255.;

    let weights = array<f32, 4>(
      uniforms.params[0].weight,
      uniforms.params[1].weight,
      uniforms.params[2].weight,
      uniforms.params[3].weight,
    );
    let xyz = rgb2xyz(vec3f(r, g, b));

    let idx = decideIndexByFacesAndWeights(bgPos, samplePallet, weights, xyz);

    // 白か色かの判定
    let res = classifyWithThreshold(
      bgPos, samplePallet, xyz, idx,
      uniforms.params[u32(idx)].threshold
    );

    // 出力値の決定
    // col = 0xCCIIPPFF: C: color index, I: intensity (0-255) (0 is white), P: padding, F: always 255
    let col = u32(idx) | (select(0xFFu, 0x00u, res.isWhite) << 8u) | (0x00u << 16u) | (0xFFu << 24u);
    var pres = res.pressure;

    let pixelIn2 = imageIn2[u32(index)];
    let r2 = f32((pixelIn2 >> 0u) & 0xFFu) / 255.;
    let b2 = f32((pixelIn2 >> 16u) & 0xFFu) / 255.;
    pres = min(pres * (1.0 + (r2 - b2) * 1.0), 1.0);

    // 出力 pressure, color
    imageOutP[u32(index)] = 1.0 - pres;
    imageOutC[u32(index)] = col;
    // imageOutD[u32(index)] = u32((xyz.x / 2.0 + 0.5) * 255.0) | (u32((xyz.y / 2.0) * 255.0) << 8u) | (u32((xyz.z / 2.0 + 0.5) * 255.0) << 16u) | (0xFFu << 24u);
  }
  
  const EPS: f32 = 1e-6;

  struct Hit {
    hit: bool,
    t: f32,
    q: vec3f,   // 交点
  }

  // 直線 ro + t * rd と、点 p0,p1,p2 が張る「平面」との交点
  fn intersectRayPlane(ro: vec3f, rd: vec3f, p0: vec3f, p1: vec3f, p2: vec3f) -> Hit {
    let n = normalize(cross(p1 - p0, p2 - p0));
    let denom = dot(rd, n);
    // 平行 or ほぼ平行
    if (abs(denom) < EPS) {
      return Hit(false, 0.0, vec3f(0.0));
    }
    let t = dot(p0 - ro, n) / denom;
    // 直線の「進行方向の先」にない（t < 0）は無効
    if (t < 0.0) {
      return Hit(false, t, vec3f(0.0));
    }
    let q = ro + t * rd;
    return Hit(true, t, q);
  }

  // 3つの面 (0,1,2), (0,2,3), (0,1,3) と白→p の直線との交点のうち、最も近いものを返す
  fn closestIntersectionOnFaces(white: vec3f, samplePallet: array<vec3f, 4>, p: vec3f) -> Hit {
    let rd = p - white;

    var best = Hit(false, 1e30, vec3f(0.0));

    // 面1: (0,1,2)
    {
      let h = intersectRayPlane(white, rd, samplePallet[0], samplePallet[1], samplePallet[2]);
      if (h.hit && h.t < best.t) { best = h; }
    }
    // 面2: (0,2,3)
    {
      let h = intersectRayPlane(white, rd, samplePallet[0], samplePallet[2], samplePallet[3]);
      if (h.hit && h.t < best.t) { best = h; }
    }
    // 面3: (0,1,3)
    {
      let h = intersectRayPlane(white, rd, samplePallet[0], samplePallet[1], samplePallet[3]);
      if (h.hit && h.t < best.t) { best = h; }
    }

    return best;
  }

  // 交点 q が得られたら、点(0..3) それぞれへの距離に weights を掛けたスコアで最も近い色を選ぶ
  // スコア: score_i = weights[i] / max(distance(q, sample[i]), EPS)
  fn pickIndexByWeightedNearest(samplePallet: array<vec3f, 4>, weights: array<f32, 4>, q: vec3f) -> i32 {
    var bestIdx: i32 = 0;
    var bestScore: f32 = -1.0;

    for (var i: u32 = 0u; i < 4u; i++) {
      let d = length(q - samplePallet[i]);
      let w = max(weights[i], EPS);
      let score = w / max(d, EPS);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i32(i);
      }
    }
    return bestIdx;
  }

  // メインの判定関数：
  // 1) 白→p の直線と 3面の交点のうち最も近いものを取得
  // 2) 交点が見つかれば weights を加味して 0..3 のどれに属するか決定
  // 3) 交点が見つからなければフォールバック（p に最も近い色を weights 付きで選択）
  fn decideIndexByFacesAndWeights(
    white: vec3f,
    samplePallet: array<vec3f, 4>,
    weights: array<f32, 4>,
    p: vec3f
  ) -> i32 {
    let h = closestIntersectionOnFaces(white, samplePallet, p);
    if (h.hit) {
      return pickIndexByWeightedNearest(samplePallet, weights, h.q);
    } else {
      // フォールバック：交点が得られないときは p 自体で重み付き最近傍
      return pickIndexByWeightedNearest(samplePallet, weights, p);
    }
  }

  struct ClassifyResult {
    isWhite: bool,
    colorIdx: i32,
    pressure: f32,
  }

  fn classifyWithThreshold(
    bgPos: vec3f,
    samplePallet: array<vec3f, 4>,
    xyz: vec3f,
    idx: i32,
    threshold: f32
  ) -> ClassifyResult {
    let colPos = samplePallet[u32(idx)];

    // 線分 bgPos → colPos の方向
    let dir = colPos - bgPos;
    let len2 = dot(dir, dir);

    // xyz を bgPos を基準に射影して [0,1] の範囲に正規化
    var t = dot(xyz - bgPos, dir) / len2;
    t = clamp(t, 0.0, 1.0);

    // t が閾値未満なら白、それ以外は色
    if (t < threshold) {
      return ClassifyResult(true, -1, t); // 白
    } else {
      return ClassifyResult(false, idx, t); // 色
    }
  }

  fn rgb2hsl(rgb: vec3f) -> vec3f {
    let r = rgb.x;
    let g = rgb.y;
    let b = rgb.z;

    let maxc = max(r, max(g, b));
    let minc = min(r, min(g, b));
    let delta = maxc - minc;

    var H: f32 = 0.0;
    var S: f32 = 0.0;
    let L: f32 = 0.5 * (maxc + minc);

    if (delta != 0.0) {
      if (maxc == r) {
        H = (g - b) / delta + (select(0.0, 6.0, g < b));
      } else if (maxc == g) {
        H = (b - r) / delta + 2.0;
      } else { // maxc == b
        H = (r - g) / delta + 4.0;
      }
      H = H / 6.0; // 0〜1に正規化

      S = delta / (1.0 - abs(2.0 * L - 1.0));
    }

    return vec3f(H, S, L);
  }

  fn hsl2xyz(hsl: vec3f) -> vec3f {
    let h = hsl.x * 2.0 * 3.14159265;
    let s = hsl.y;
    let l = hsl.z;

    let absVal = abs(2.0 * l - 1.0);
    let x = (1.0 - absVal) * s * cos(h);
    let z = (1.0 - absVal) * s * sin(h);
    let y = l * 2.0;

    return vec3f(x, y, z);
  }

  fn rgb2xyz(rgb: vec3f) -> vec3f {
    return hsl2xyz(rgb2hsl(rgb));
  }
`;

const sharpnessShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<f32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<f32>;

  const sp = 0.1;
  const gaussKernel: array<array<f32, 3>, 3> = array(
    array<f32, 3>(-sp, -sp, -sp),
    array<f32, 3>(-sp, 1.0 + 8*sp, -sp),
    array<f32, 3>(-sp, -sp, -sp)
  );
  const ksz = 1;

  // const gaussKernel: array<array<f32, 5>, 5> = array(
  //   array<f32, 5>(1.0, 4.0, 6.0, 4.0, 1.0),
  //   array<f32, 5>(4.0, 16.0, 24.0, 16.0, 4.0),
  //   array<f32, 5>(6.0, 24.0, 36.0, 24.0, 6.0),
  //   array<f32, 5>(4.0, 16.0, 24.0, 16.0, 4.0),
  //   array<f32, 5>(1.0, 4.0, 6.0, 4.0, 1.0)
  // );
  // const ksz = 2;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) { return; }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let h = i32(height);
    let index = y * w + x;

    var sum: f32 = 0.0;
    var weightSum: f32 = 0.0;

    for (var dy = -ksz; dy <= ksz; dy++) {
      for (var dx = -ksz; dx <= ksz; dx++) {
        let sx = clamp(x + dx, 0, w - 1);
        let sy = clamp(y + dy, 0, h - 1);
        let sampleIndex = sy * w + sx;

        let value = imageIn[u32(sampleIndex)];
        let weight = gaussKernel[(dy + ksz)][(dx + ksz)];

        sum += value * weight;
        weightSum += weight;
      }
    }

    let blurred = clamp(sum / weightSum + 0.1, 0.0, 1.0);
    imageOut[u32(index)] = blurred;
  }
`;

const gaussianShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<f32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<f32>;

  const gaussKernel: array<array<f32, 3>, 3> = array(
    array<f32, 3>(1.0, 2.0, 1.0),
    array<f32, 3>(2.0, 4.0, 2.0),
    array<f32, 3>(1.0, 2.0, 1.0)
  );
  const ksz = 1;

  // const gaussKernel: array<array<f32, 5>, 5> = array(
  //   array<f32, 5>(1.0, 4.0, 6.0, 4.0, 1.0),
  //   array<f32, 5>(4.0, 16.0, 24.0, 16.0, 4.0),
  //   array<f32, 5>(6.0, 24.0, 36.0, 24.0, 6.0),
  //   array<f32, 5>(4.0, 16.0, 24.0, 16.0, 4.0),
  //   array<f32, 5>(1.0, 4.0, 6.0, 4.0, 1.0)
  // );
  // const ksz = 2;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) { return; }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let h = i32(height);
    let index = y * w + x;

    var sum: f32 = 0.0;
    var weightSum: f32 = 0.0;

    for (var dy = -ksz; dy <= ksz; dy++) {
      for (var dx = -ksz; dx <= ksz; dx++) {
        let sx = clamp(x + dx, 0, w - 1);
        let sy = clamp(y + dy, 0, h - 1);
        let sampleIndex = sy * w + sx;

        let value = imageIn[u32(sampleIndex)];
        let weight = gaussKernel[(dy + ksz)][(dx + ksz)];

        sum += value * weight;
        weightSum += weight;
      }
    }

    let blurred = clamp(sum / weightSum, 0.0, 1.0);
    imageOut[u32(index)] = blurred;
  }
`;

const gaussianMultColShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<u32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<u32>;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) { return; }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let h = i32(height);
    let index = y * w + x;

    let colId = (imageIn[u32(index)] >> 0u ) & 0xFFu; // 下位8ビットに色IDが入っている
    var sum: f32 = 0.0;
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        let sx = clamp(x + dx, 0, w - 1);
        let sy = clamp(y + dy, 0, h - 1);
        let sampleIndex = sy * w + sx;
        let pixel = imageIn[u32(sampleIndex)];

        let colId2 = (pixel >> 0u ) & 0xFFu; // 下位8ビットに色IDが入っている
        let value = f32((pixel >> 8u) & 0xFFu); // 上位8ビットに色値が入っている

        sum += select(-value * 1, value, colId == colId2);
      }
    }

    sum = clamp(sum / 25.0, 0.0, 255.0);
    let res = u32(colId) | (u32(sum) << 8u) | (0x00u << 16u) | (0xFFu << 24u); // col = 0xCCIIPPFF
    imageOut[u32(index)] = res;
  }
`;

const laplacianShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<f32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<f32>;

  // 3x3 ラプラシアンフィルタ
  const lapKernel: array<array<f32, 3>, 3> = array(
    array<f32, 3>(0.0, 1.0, 0.0),
    array<f32, 3>(1.0, -4.0, 1.0),
    array<f32, 3>(0.0, 1.0, 0.0)
  );
  const ksz = 1;

  // 5x5 ラプラシアンフィルタ
  // const lapKernel: array<array<f32, 5>, 5> = array(
  //   array<f32, 5>(0.0, 0.0, 1.0, 0.0, 0.0),
  //   array<f32, 5>(0.0, 1.0, 2.0, 1.0, 0.0),
  //   array<f32, 5>(1.0, 2.0,-16.0, 2.0, 1.0),
  //   array<f32, 5>(0.0, 1.0, 2.0, 1.0, 0.0),
  //   array<f32, 5>(0.0, 0.0, 1.0, 0.0, 0.0),
  // );
  // const ksz = 2;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) { return; }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let h = i32(height);
    let index = y * w + x;

    var sum: f32 = 0.0;
    for (var dy = -ksz; dy <= ksz; dy++) {
      for (var dx = -ksz; dx <= ksz; dx++) {
        let sx = clamp(x + dx, 0, w - 1);
        let sy = clamp(y + dy, 0, h - 1);
        let sampleIndex = sy * w + sx;

        let value = imageIn[u32(sampleIndex)];
        let weight = lapKernel[(dy + ksz)][(dx + ksz)];

        // sum += 10.0 * min(min(value + 0.1, 1.0) * 0.1, 0.1) * weight;
        sum += min(value + 0.05, 1.0) * weight;
      }
    }

    var edge = 1.0 - clamp(20 * sum, 0.0, 1.0);
    imageOut[u32(index)] = edge;
  }
`;

const affineBinaryShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<f32>;
  @group(0) @binding(2) var<storage, read> imageIn2: array<f32>;
  @group(0) @binding(3) var<storage, read> imageIn3: array<u32>;
  @group(0) @binding(4) var<storage, read_write> imageOut: array<u32>;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) {
      return;
    }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let index = y * w + x;

    let pres = imageIn[u32(index)];
    let lap = imageIn2[u32(index)];

    let pixelGau = imageIn3[u32(index)];
    let colId = (pixelGau >> 0u ) & 0xFFu; // 色ID
    let gau = f32((pixelGau >> 8u) & 0xFFu); // 色値

    // 閾値処理
    let gauFactor = 0.0004 * (uniforms.params[colId].logFac * 2.0 - uniforms.params[colId].gauFac) * gau;
    let lapFactor = 0.1 * uniforms.params[colId].logFac * (1.0 - lap);
    let factor = lapFactor - gauFactor;
    let threshold = min(uniforms.params[colId].threshold + clamp(factor, 0.0, 1.0), 0.9);

    let res = select(4u, colId, pres < threshold);
    let outPixel = u32(res) | (0xFFu << 8u) | (0x00u << 16u) | (0xFFu << 24u); // 0xCCIIPPFF
    imageOut[u32(index)] = outPixel;
  }
`;

const denoise3x3ShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<u32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<u32>;

  const dirs = array<vec2<i32>, 8>(
    vec2<i32>(0, -1), vec2<i32>(-1, 0), vec2<i32>(1, 0), vec2<i32>(0, 1),
    vec2<i32>(-1, -1), vec2<i32>(1, -1), vec2<i32>(-1, 1), vec2<i32>(1, 1),
  );

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) {
      return;
    }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let index = y * w + x;

    let pixel = imageIn[u32(index)];
    // col = 0xCCIIPPFF: C: color index, I: intensity, P: padding, F: always 255
    let colId = (pixel >> 0u) & 0xFFu; // 下位8ビットに色IDが入っている

    // dirsの方向をチェックして、同じ色がなければ最も多い隣接色に置き換え
    var counts = array<u32, 5>(0u, 0u, 0u, 0u, 0u); // 黒, 赤, 緑, 青, 白
    for (var i = 0; i < 8; i++) {
      let dx = dirs[i].x;
      let dy = dirs[i].y;
      let sx = clamp(x + dx, 0, w - 1);
      let sy = clamp(y + dy, 0, i32(height) - 1);
      let sampleIndex = sy * w + sx;
      let samplePixel = imageIn[u32(sampleIndex)];
      let sampleColId = (samplePixel >> 0u ) & 0xFFu;
      counts[u32(sampleColId)] += 1u;
    }
    // 自分と同じ色が1つもなければ、最も多い隣接色に置き換え
    if (counts[u32(colId)] > 0u) {
      let outPixel = colId | (0xFFu << 8u) | (0x00u << 16u) | (0xFFu << 24u);
      imageOut[u32(index)] = outPixel;
      return;
    }
    var maxCount = counts[0];
    var maxIdx: u32 = 0u;
    for (var i: u32 = 0u; i < 5u; i++) {
      if (counts[i] > maxCount) {
        maxCount = counts[i];
        maxIdx = i;
      }
    }
    // col = 0xCCIIPPFF: C: color index, I: intensity, P: padding, F: always 255
    let outPixel = maxIdx | (0xFFu << 8u) | (0x00u << 16u) | (0xFFu << 24u);
    imageOut[u32(index)] = outPixel;
  }
`;

const denoise5x5ShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<u32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<u32>;

  const outer = array<vec2<i32>, 16>(
    vec2<i32>(-2,-2), vec2<i32>(-2, 2), vec2<i32>(2, 2), vec2<i32>( 2,-2),
    vec2<i32>(-2,-1), vec2<i32>(-1, 2), vec2<i32>(2, 1), vec2<i32>( 1,-2),
    vec2<i32>(-2, 0), vec2<i32>( 0, 2), vec2<i32>(2, 0), vec2<i32>( 0,-2),
    vec2<i32>(-2, 1), vec2<i32>( 1, 2), vec2<i32>(2,-1), vec2<i32>(-1,-2),
  );
  
  const inner = array<vec2<i32>, 8>(
    vec2<i32>(0, -1), vec2<i32>(-1, 0), vec2<i32>(1, 0), vec2<i32>(0, 1),
    vec2<i32>(-1, -1), vec2<i32>(1, -1), vec2<i32>(-1, 1), vec2<i32>(1, 1),
  );

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) {
      return;
    }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let index = y * w + x;

    let pixel = imageIn[u32(index)];
    // col = 0xCCIIPPFF: C: color index, I: intensity, P: padding, F: always 255
    let colId = (pixel >> 0u) & 0xFFu; // 0-7bit: 色ID

    if (colId == 4u) {
      let outPixel = colId | (0xFFu << 8u) | (0x00u << 16u) | (0xFFu << 24u);
      imageOut[u32(index)] = outPixel;
      return;
    }

    // --- Step1: 外周チェック ---
    var outerFound = false;
    for (var i = 0; i < 16; i++) {
      let dx = outer[i].x;
      let dy = outer[i].y;
      let sx = clamp(x + dx, 0, w - 1);
      let sy = clamp(y + dy, 0, i32(height) - 1);
      let sample = imageIn[u32(sy * w + sx)];
      if ((sample & 0xFFu) == colId) {
        outerFound = true;
        break;
      }
    }

    // --- Step2: 3x3 内側カウント ---
    var innerCount = 1u; // 自分自身を含める
    for (var i = 0; i < 8; i++) {
      let dx = inner[i].x;
      let dy = inner[i].y;
      let sx = clamp(x + dx, 0, w - 1);
      let sy = clamp(y + dy, 0, i32(height) - 1);
      let sample = imageIn[u32(sy * w + sx)];
      if ((sample & 0xFFu) == colId) {
        innerCount++;
      }
    }

    // --- Step3: 5x5 多数決 ---
    var counts = array<u32, 5>(0u, 0u, 0u, 0u, 0u);
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        let sx = clamp(x + dx, 0, w - 1);
        let sy = clamp(y + dy, 0, i32(height) - 1);
        let sample = imageIn[u32(sy * w + sx)];
        let cid = (sample & 0xFFu);
        counts[cid] += 1u;
      }
    }

    var maxCount = counts[0];
    var maxIdx: u32 = 0u;
    for (var i: u32 = 1u; i < 5u; i++) {
      if (counts[i] > maxCount) {
        maxCount = counts[i];
        maxIdx = i;
      }
    }

    // --- Step4: 判定 ---
    var outId: u32 = colId;
    if (outerFound) {
      outId = colId; // 外周に同色がある → ディテール → 残す
    } else {
      if (innerCount <= 3u) {
        outId = maxIdx; // ノイズ → 溶かす
      } else {
        outId = colId;  // ディテール → 残す
      }
    }

    // col = 0xCCIIPPFF: C: color index, I: intensity, P: padding, F: always 255
    let outPixel = outId | (0xFFu << 8u) | (0x00u << 16u) | (0xFFu << 24u);
    imageOut[u32(index)] = outPixel;
  }
`;

const colorIndexToColorShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<u32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<u32>;

  // 色パレット (黒, 赤, 緑, 青, 白)
  const idPallet = array<vec3f, 5>(
    vec3f(0.,0.,0.),
    vec3f(255.,0.,0.),
    vec3f(0.,255.,0.),
    vec3f(0.,0.,255.),
    vec3f(255.,255.,255.),
  );

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) {
      return;
    }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let index = y * w + x;
    let pixelIn = imageIn[u32(index)];

    let colId = (pixelIn >> 0u ) & 0xFFu; // 下位8ビットに色IDが入っている
    let intensity = (pixelIn >> 8u) & 0xFFu; // 上位8ビットに色値が入っている
    let col = idPallet[u32(colId)] * (f32(intensity) / 255.0);
    let outPixel = u32(col.r) | (u32(col.g) << 8u) | (u32(col.b) << 16u) | (0xFFu << 24u);
    imageOut[u32(index)] = outPixel;
  }
`;

const outputFloatShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<f32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<u32>;
  
  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) {
      return;
    }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let index = y * w + x;

    // imageIn[0-1] を imageOut[0-255] に変換して出力
    let fVal = clamp(imageIn[u32(index)], 0.0, 1.0);
    let gray = u32(fVal * 255.0);
    let outPixel = gray | (gray << 8u) | (gray << 16u) | (0xFFu << 24u);
    imageOut[u32(index)] = outPixel;
  }
`;
// ↑↑ 各種シェーダーコード ↑↑

// --- WebGPU初期化 ---
let device = null;
const workgroupSize = 8;
async function initWebGPU() {
  if (!navigator.gpu) {
    showStatus('WebGPUはこのブラウザでサポートされていません', 'error');
    return false;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    showStatus('WebGPUアダプター取得に失敗しました', 'error');
    return false;
  }
  device = await adapter.requestDevice();
  showStatus('WebGPUが初期化されました', 'success', 3000);
  return true;
}

// --- 画像処理 ---
function preparePipelines(imageData, drawImageData, gCfg, fCfg) {
  const width = imageData.width;
  const height = imageData.height;
  const pixelCount = width * height;
  const gColBlks = gCfg.colorBlocks;
  const fColBlks = fCfg ? fCfg.colorBlocks : null;
  const cbKeys = Object.keys(gCfg.colorBlocks);

  const paramsSize = Math.ceil((cbKeys.length) / 4) * 4;
  const uniSize = Math.ceil((8 * paramsSize + 8) / 4) * 4;
  const buffers = {
    uniform: device.createBuffer({ size: uniSize * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
    input: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
    drawInput: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
    // DEBUG: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    pSharp: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    pressure: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    pressureOut: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    binary: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    gaussian: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    logBuffer: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    log: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    logOut: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    preDenoise: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    denoiseBuffer: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    output: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    readbackPressure: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
    readbackLoG: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
    readbackpDen: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
    readback: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
    readbackDEB: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
  };
  const pixelArray = new Uint32Array(imageData.data.buffer);
  device.queue.writeBuffer(buffers.input, 0, pixelArray);

  if (drawImageData){
    const pixelArray2 = new Uint32Array(drawImageData.data.buffer);
    device.queue.writeBuffer(buffers.drawInput, 0, pixelArray2);
  }

  // width, height は u32、threshold は f32
  makeUniformsCodes(paramsSize);
  const uniformArray = new ArrayBuffer(uniSize * 4);
  const u32View = new Uint32Array(uniformArray);
  const f32View = new Float32Array(uniformArray);
  u32View[0] = width;
  u32View[1] = height;
  u32View[2] = cbKeys.length;
  u32View[3] = 0; // padding
  const base = 4;
  for(let i = 0; i < cbKeys.length; ++i){ // 各色毎（黒, 赤, 緑, 青, ...）
    const col = hexToRgb01(fCfg ? fColBlks[cbKeys[i]].color : gColBlks[cbKeys[i]].color);
    f32View[i*8 + base + 0] = col[0];
    f32View[i*8 + base + 1] = col[1];
    f32View[i*8 + base + 2] = col[2];
    f32View[i*8 + base + 3] = 0;
    const sliders = gColBlks[cbKeys[i]].sliders;
    f32View[i*8 + base + 4] = sliders.threshold;
    f32View[i*8 + base + 5] = sliders.log;
    f32View[i*8 + base + 6] = sliders.gau;
    f32View[i*8 + base + 7] = sliders.weight;
    if(fCfg){
      const fSliders = fColBlks[cbKeys[i]].sliders;
      f32View[i*8 + base + 4] += fSliders.threshold;
      f32View[i*8 + base + 5] += fSliders.log;
      f32View[i*8 + base + 6] += fSliders.gau;
      f32View[i*8 + base + 7] += fSliders.weight;
    }
  }
  const bgCol = hexToRgb01(fCfg ? fCfg.bgColor : gCfg.bgColor);
  f32View[8 * (cbKeys.length) + base + 0] = bgCol[0];
  f32View[8 * (cbKeys.length) + base + 1] = bgCol[1];
  f32View[8 * (cbKeys.length) + base + 2] = bgCol[2];
  f32View[8 * (cbKeys.length) + base + 3] = 0;
  device.queue.writeBuffer(buffers.uniform, 0, uniformArray);

  const steps = [
    {
      name: 'TracePressure',
      code: uniformsCode + tracePressShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'input', binding: 1, type: 'read-only-storage' },
        { name: 'drawInput', binding: 2, type: 'read-only-storage' },
        { name: 'pSharp', binding: 3, type: 'storage' },
        { name: 'binary', binding: 4, type: 'storage' },
        // { name: 'DEBUG', binding: 4, type: 'storage' },
      ]
    },
    { // 筆圧値：シャープネスフィルタ
      name: 'Sharpness',
      code: uniformsCode + sharpnessShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'pSharp', binding: 1, type: 'read-only-storage' },
        { name: 'pressure', binding: 2, type: 'storage' },
      ]
    },
    { // 筆圧値：Floatをグレーに変換
      name: 'Pres_Pressure',
      code: uniformsCode + outputFloatShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'pressure', binding: 1, type: 'read-only-storage' },
        { name: 'pressureOut', binding: 2, type: 'storage' },
      ]
    },
    {
      name: 'LoG_Gaussian',
      code: uniformsCode + gaussianShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'pressure', binding: 1, type: 'read-only-storage' },
        { name: 'log', binding: 2, type: 'storage' },
      ]
    },
    {
      name: 'LoG_Laplacian',
      code: uniformsCode + laplacianShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'log', binding: 1, type: 'read-only-storage' },
        { name: 'logBuffer', binding: 2, type: 'storage' },
      ]
    },
    {
      name: 'LoG_Gaussian2',
      code: uniformsCode + gaussianShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'logBuffer', binding: 1, type: 'read-only-storage' },
        { name: 'log', binding: 2, type: 'storage' },
      ]
    },
    { // LoGフィルタ：Floatをグレーに変換
      name: 'DebugOutputLoG',
      code: uniformsCode + outputFloatShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'log', binding: 1, type: 'read-only-storage' },
        { name: 'logOut', binding: 2, type: 'storage' },
      ]
    },
    {
      name: 'Gau_Gaussian',
      code: uniformsCode + gaussianMultColShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'binary', binding: 1, type: 'read-only-storage' },
        { name: 'gaussian', binding: 2, type: 'storage' },
      ]
    },
    {
      name: 'AffineBinary',
      code: uniformsCode + affineBinaryShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'pressure', binding: 1, type: 'read-only-storage' },
        { name: 'log', binding: 2, type: 'read-only-storage' },
        { name: 'gaussian', binding: 3, type: 'read-only-storage' },
        { name: 'preDenoise', binding: 4, type: 'storage' },
      ]
    },
    {
      name: 'Denoise5x5',
      code: uniformsCode + denoise5x5ShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'preDenoise', binding: 1, type: 'read-only-storage' },
        { name: 'denoiseBuffer', binding: 2, type: 'storage' },
      ]
    },
    {
      name: 'Denoise3x3',
      code: uniformsCode + denoise3x3ShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'denoiseBuffer', binding: 1, type: 'read-only-storage' },
        { name: 'binary', binding: 2, type: 'storage' },
      ]
    },
    { // 最終結果：最終結果を色に変換
      name: 'ColorIndexToColor',
      code: uniformsCode + colorIndexToColorShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'binary', binding: 1, type: 'read-only-storage' },
        { name: 'output', binding: 2, type: 'storage' },
      ]
    },
  ];

  return { buffers, steps, width, height };
}

let gpuProcessing = false;
async function processImage(idx) {
  imageData = uploadedImages[idx];
  drawImageData = drawImages[idx];
  if (!device || !imageData) return showStatus('準備が整っていません', 'error', 3000);
  if (gpuProcessing) return;
  gpuProcessing = true;
  showStatus('<div class="loading"><div class="spinner"></div>WebGPUで処理中...</div>');
  try {

    const { buffers, steps, width, height } = preparePipelines(imageData, drawImageData, globalConfig, frameConfigs[idx]);

    for (const step of steps) {
      const encoder = await runShader(step.code, buffers, step.bindings, width, height);
      device.queue.submit([encoder.finish()]);
    }
    
    // モードと対応する readback バッファを定義 // [modename]: [readbackBufferName]
    const modeToBuffer = {
      pressure: "readbackPressure",
      log: "readbackLoG",
      processed: "readback",
      // DEBUG: "readbackDEB",
    };

    const encoder = device.createCommandEncoder();
    // 処理結果を readback バッファにコピー // [outputBufferName, readbackBufferName]
    const copyMap = [
      ["pressureOut", "readbackPressure"],
      ["logOut", "readbackLoG"],
      ["output", "readback"],
      // ["DEBUG", "readbackDEB"],
    ];

    for (const [src, dst] of copyMap) {
      encoder.copyBufferToBuffer(buffers[src], 0, buffers[dst], 0, width * height * 4);
    }
    device.queue.submit([encoder.finish()]);

    for(const key of Object.keys(modeToBuffer)){
      const bufferKey = modeToBuffer[key];
      const buffer = buffers[bufferKey];
      // 読み込み
      await buffer.mapAsync(GPUMapMode.READ);
      const result = new Uint32Array(buffer.getMappedRange());
      // 表示
      cacheProcessedImage(result, width, height);
      // 後処理
      buffer.unmap();

      processedImages[key][idx] = {
        img: osctx.getImageData(0, 0, canvas.width, canvas.height),
        phase: updatePhase,
      };
    }
    
    showStatus('処理が完了しました', 'success', 3000);
  } finally {
    gpuProcessing = false;
  }
}

async function showImage(i) {
  if (!uploadedImages[i]) return;

  const newWidth = uploadedImages[i].width;
  const newHeight = uploadedImages[i].height;
  if (canvas.width !== newWidth || canvas.height !== newHeight) {
    canvas.width = newWidth;
    canvas.height = newHeight;
    offscreenCanvas.width = newWidth;
    offscreenCanvas.height = newHeight;
    drawCanvas.width = newWidth;
    drawCanvas.height = newHeight;
    overlayCanvas.width = newWidth;
    overlayCanvas.height = newHeight;
  }

  if(showMode == 'original'){
    ctx.putImageData(uploadedImages[i], 0, 0);
  } else {
    if(updatePhase != processedImages[showMode][i]?.phase){
      await processImage(i);
    }
    if(processedImages[showMode][i]?.img){
      ctx.putImageData(processedImages[showMode][i].img, 0, 0);
    }

    // 全部処理済みかどうかチェック
    let allProcessed = true;
    for (let j = 0; j < uploadedImages.length; j++) {
      if (!processedImages[showMode][j]?.img || updatePhase != processedImages[showMode][j]?.phase) {
        allProcessed = false;
        frameBtns[j].fbtn.style.backgroundColor = 'rgba(233, 84, 109, 1)';
      } else {
        frameBtns[j].fbtn.style.backgroundColor = 'rgba(84, 106, 233, 1)';
      }
    }
    if(allProcessed){
      allProcBtn.classList.remove('blink');
    } else {
      allProcBtn.classList.add('blink');
    }
  }
}

function cacheProcessedImage(outputArray, width, height) {
  // Uint32Array か Uint8Array かを判別して Uint8ClampedArray に変換
  let u8;
  if (outputArray instanceof Uint32Array) {
    u8 = new Uint8ClampedArray(outputArray.buffer);
  } else {
    // denoise 後は Uint8Array なのでそのまま
    u8 = new Uint8ClampedArray(outputArray.buffer);
  }
  const imageData = new ImageData(u8, width, height);
  osctx.putImageData(imageData, 0, 0);
}


initWebGPU();
// --- GPU処理実行 ---
async function runShader(shaderCode, buffers, bindings, width, height) {
  const shaderModule = device.createShaderModule({ code: shaderCode });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: bindings.map(({ binding, type }) => ({
      binding,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type }
    }))
  });

  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    compute: { module: shaderModule, entryPoint: 'main' }
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: bindings.map(({ binding, name }) => ({
      binding,
      resource: { buffer: buffers[name] }
    }))
  });

  const commandEncoder = device.createCommandEncoder();
  const pass = commandEncoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(
    Math.ceil(width / workgroupSize),
    Math.ceil(height / workgroupSize)
  );
  pass.end();
  return commandEncoder;
}

function hexToRgb01(hex) {
  // #を除去
  hex = hex.replace(/^#/, '');

  // 各チャンネルを16進数から10進数に
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  return [r, g, b];
}
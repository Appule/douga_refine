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

// Draw ImageData directly to the visible canvas
function showImage(imageData) {
  if (!imageData) return;
  ctx.putImageData(imageData, 0, 0);
}

// Update frame buttons' styles and the all-process indicator for the given mode
function updateFrameButtonsForMode(mode) {
  let allProcessed = true;
  for (let j = 0; j < uploadedImages.length; j++) {
    const proc = processedImages[mode]?.[j];
    const done = proc?.img && proc?.phase === window.AppState.updatePhase;
    const btn = frameBtns[j];
    if (!btn) continue;
    if (!done) {
      allProcessed = false;
      btn.fbtn.style.backgroundColor = 'rgba(233, 84, 109, 1)';
    } else {
      btn.fbtn.style.backgroundColor = 'rgba(84, 106, 233, 1)';
    }
  }
  if (allProcessed) {
    window.FloatPanel.allProcBtn.classList.remove('blink');
  } else {
    window.FloatPanel.allProcBtn.classList.add('blink');
  }
}

let frameIndex = 0; // 現在のフレーム番号
let frameCfgIndex = 0; // 現在のコンフィグフレーム番号
let cfgToggleStates = []; // コンフィグボタンのトグル状態
let cfgIsPressed = false; // コンフィグボタンの押下状態

// colorBlock ... label(色の名前): { color: 色の値, sliders: {} }
window.AppState = {
  showMode: 'processed', // 現在の描画モード
  cursorMode: 'camera', // 現在のカーソルモード
  currentConfig: { bgColor: '#ffffff', bgLabelColor: '#ffffff', colorBlocks: [] }, // 表示中のコンフィグデータ
  globalConfig: { }, // グローバルコンフィグ
  frameConfigs: [ ], // フレームコンフィグ
  updatePhase: 0, // コンフィグの状態
}

const frameBtns = []; // フレームボタン用

let processedImages = { pressure: [], log: [], processed: [] }; // 処理後画像の保持
let uploadedImages = []; // アップロードした画像
let drawImages = []; // マーキング画像

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

// ページ設定
document.addEventListener('DOMContentLoaded', () => {

  window.ConfigEditor.init();

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
});

function applyCurrentDrawing(){
  drawImages[frameIndex] = dctx.getImageData(0, 0, canvas.width, canvas.height);
  frameBtns[frameIndex].dbtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
  if(processedImages[window.AppState.showMode]?.[frameIndex]) processedImages[window.AppState.showMode][frameIndex].phase -= 1;
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
  
  // フロートパネルのファイル名欄を更新
  window.FloatPanel.fileNameInput.value = fileInfos[0].basename;
  window.FloatPanel.fileNameInput.dispatchEvent(new Event('input'));

  // フレームメニューを初期化
  menuContent.innerHTML = '';
  frameBtns.length = 0;
  frameIndex = 0;
  cfgToggleStates.length = 0;
  window.AppState.frameConfigs.length = 0;
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
      await prepareAndShowImage(index, window.AppState.showMode);
      // frameIndexのボタンを強調表示
      updateFrmBtns(index);
    });
    fbtn.addEventListener("mouseenter", async () => {
      if(buttonIsPressed) {
        fbtn.classList.add('active');
        frameIndex = index;
        await prepareAndShowImage(index, window.AppState.showMode);
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
      if(event.button == 0) {
        cfgIsPressed = true;
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
      }
      else if(event.button == 2) {
        cfgIsPressed = false;
        cfgToggleStates.fill(false);
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
          imgData = await window.ImageLoader.loadTGA(info.file);
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
  ++window.AppState.updatePhase;
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
    await prepareAndShowImage(0, window.AppState.showMode);
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
    window.ConfigEditor.updateConfig(window.AppState.globalConfig, false);
    pColorEditorMode = colorEditorMode;
  } else {
    colorEditorTitle.innerHTML = 'カラー編集 ⇒ <i class="fa-regular fa-images"></i> フレームコンフィグ';
    colorEditorMode = 'frames';
    const cfg = window.AppState.frameConfigs[frameCfgIndex] ? window.AppState.frameConfigs[frameCfgIndex] : window.AppState.currentConfig;
    window.ConfigEditor.updateConfig(cfg, false);
    pColorEditorMode = colorEditorMode;
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
        prepareAndShowImage(frameIndex, window.AppState.showMode);
        updateFrmBtns(frameIndex);
      }
    } else {
      // Decrement current frame
      if (uploadedImages.length) {
        frameIndex = Math.max(0, frameIndex - 1);
        prepareAndShowImage(frameIndex, window.AppState.showMode);
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
        prepareAndShowImage(frameIndex, window.AppState.showMode);
        updateFrmBtns(frameIndex);
      }
    } else {
      // Increment current frame
      if (uploadedImages.length) {
        frameIndex = Math.min(uploadedImages.length - 1, frameIndex + 1);
        prepareAndShowImage(frameIndex, window.AppState.showMode);
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
    window.AppState.showMode = (window.AppState.showMode === 'processed') ? 'original' : 'processed';
    prepareAndShowImage(frameIndex, window.AppState.showMode);
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
  if (window.AppState.updatePhase != processedImages[showMode][i]?.phase) {
    const cfgToUse = (window.AppState.frameConfigs && window.AppState.frameConfigs[i]) ? window.AppState.frameConfigs[i] : window.AppState.globalConfig;
    await processImage(uploadedImages[i], drawImages[i], cfgToUse, i);
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
  if (window.AppState.cursorMode !== 'camera') return;
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
  if (window.AppState.cursorMode !== 'camera' || !isDragging) return;
  offsetX = e.clientX - startX;
  offsetY = e.clientY - startY;
  updateTransform();
});

editorContent.addEventListener("mouseup", () => {
  if (window.AppState.cursorMode !== 'camera') return;
  isDragging = false;
});

// 範囲選択
let isLassoing   = false;
let lassoPoints  = [];   // {x,y}
// 投げ縄開始
editorContent.addEventListener('mousedown', e => {
  if (window.AppState.cursorMode !== 'highTh' && window.AppState.cursorMode !== 'lowTh') return;

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
    fillColor = window.AppState.cursorMode == 'highTh' ? 'rgb(255, 0, 0, 0.1)' : 'rgb(0, 0, 255, 0.1)';
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
 
  prepareAndShowImage(frameIndex, window.AppState.showMode);
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


(function () {
  //// 状態管理
  // ファイルデータ
  let fileInfos = [];
  // 画像データ
  let uploadedImages = []; // アップロードした画像
  let processedImages = []; // 処理後画像の保持  [ { pressure:null, log:null, processed:null, hash:0, dhash:0, saved:false }, ... ]
  let drawImages = []; // マーキング画像
  // モード
  let showMode = 'processed'; // 現在の描画モード enableSharpness: true, denoiseLevel: 3, enableDebug: false
  let cursorMode = 'camera'; // 現在のカーソルモード
  let frameIndex = 0; // 現在のフレーム番号
  // コンフィグ
  let globalConfig = {}; // グローバルコンフィグ
  let frameConfigs = []; // フレームコンフィグ
  let dirHandle;
  let dirHandleTrace;
  let dirHandleCell;
  let traceDirEntries = [];
  let cellDirEntries = [];

  // window-global
  let fileName = '';
  let fileExt = '';

  // window-config
  let currentConfig = {};

  // window-frames

  //// HTML要素
  // ページ設定
  document.addEventListener('DOMContentLoaded', async () => {

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
    });

    window.addEventListener('blur', () => {
      isResizingV = false;
      isResizingH = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    });

    const response = await fetch('./_config/default.json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const defaultConfigFromFile = await response.json();

  });

  // 画像データ setter/getter
  const initImageDatas = function (fis) {
    uploadedImages = new Array(fis.length);
    processedImages = new Array(fis.length).fill(0).map((_) => { return { pressure: null, log: null, processed: null, hash: '', dhash: '', saved: 0 } });
    drawImages = new Array(fis.length);
    frameConfigs = new Array(fis.length).fill(0);
    fileInfos = new Array(fis.length);
    fis.forEach((fi, i) => {
      const fileInfo = {};
      fileInfo.padded = fi.padded;
      fileInfo.num = fi.num;
      fileInfo.basename = fi.basename;
      fileInfos[i] = fileInfo;
    });
  }

  const setUploadedImage = function (img, idx = frameIndex) {
    uploadedImages[idx] = img;
  }
  const getUploadedImage = function (idx = frameIndex) {
    return uploadedImages[idx];
  }

  const setProcessedData = function (data, idx = frameIndex) {
    processedImages[idx].pressure = data.pressure;
    processedImages[idx].log = data.log;
    processedImages[idx].processed = data.processed;
  }
  const getProcessedData = function (idx = frameIndex) {
    return processedImages[idx];
  }

  const setDrawImage = async function (img, idx = frameIndex) {
    const hash = await getImageDataHash(img);
    drawImages[idx] = { img, hash };

    prepareAndShowImage(idx);
  }

  // モード setter/getter
  const setShowMode = function (mode) {
    showMode = mode;
    if (cursorMode == 'camera' || mode != 'processed') window.CanvasEditor.hideDrawCanvas();
    else window.CanvasEditor.showDrawCanvas();
    prepareAndShowImage();
  }
  const getShowMode = function () { return showMode; }

  const setCursorMode = function (mode) {
    cursorMode = mode;
    if (mode == 'camera' || showMode != 'processed') window.CanvasEditor.hideDrawCanvas();
    else window.CanvasEditor.showDrawCanvas();
  }
  const getCursorMode = function () { return cursorMode; }

  const setFrameIndex = function (idx) {
    frameIndex = idx;
    window.CanvasEditor.drawImg(drawImages[idx]);
    prepareAndShowImage();
  }
  const getFrameIndex = function () { return frameIndex; }

  document.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

    const key = e.key;

    if (key.toLowerCase() === 'q' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setShowMode((getShowMode() === 'processed') ? 'original' : 'processed');
      return;
    }
  });

  // コンフィグ setter/getter
  const setGlobalConfig = function (cfg) {
    globalConfig = cfg;
    prepareAndShowImage();
  }
  const getGlobalConfig = function () { return JSON.parse(JSON.stringify(globalConfig)); }

  const setFrameConfigs = function (cfg, toggles) {
    for (let i = 0; i < frameConfigs.length; ++i) {
      if (toggles[i]) {
        frameConfigs[i] = cfg;
        window.FrameManager.drawGear(i);
      }
    }
    prepareAndShowImage();
  }
  const getFrameConfig = function (idx = frameIndex) {
    return frameConfigs[idx];
  }

  const checkLatest = function (idx) { return frameConfigs[idx] ? frameConfigs[idx].hash == processedImages[idx].hash : globalConfig.hash == processedImages[idx].hash }

  const clearFrameCfg = function () {
    const toggles = window.FrameManager.getCfgToggleStates();
    for (let i = 0; i < frameConfigs.length; ++i) {
      if (toggles[i]) {
        frameConfigs[i] = null;
      }
    }
    window.FrameManager.clearGear();
    prepareAndShowImage();
  }

  // 画像処理・描画関数
  async function prepareAndShowImage(i = frameIndex) {
    if (!uploadedImages[i]) return;

    if (showMode === 'original') {
      window.CanvasEditor.showImg(uploadedImages[i]);
      return;
    }

    const cfgToUse = frameConfigs[i] ? frameConfigs[i] : globalConfig;
    if (cfgToUse.hash != processedImages[i].hash || (drawImages[i] && (drawImages[i].hash != processedImages[i].dhash))) {
      await window.WebGPUProcessor.processImage(uploadedImages[i], drawImages[i]?.img, cfgToUse, i);
      processedImages[i].hash = cfgToUse.hash;
      processedImages[i].dhash = drawImages[i]?.hash ? drawImages[i].hash : '';
    }

    const procImg = processedImages[i][showMode];
    if (procImg) {
      window.CanvasEditor.showImg(procImg);
      window.CanvasEditor.drawImg(drawImages[i]);
    }

    // ボタンのスタイルを更新
    window.FrameManager.updateFrameButtons();
  }

  const saveImage = async function (idx, refresh) {
    // 確認処理
    if (fileName === '') {
      alert('ファイル名を入力してください。');
      return false;
    }
    if (fileExt === '') {
      alert('ファイル形式を選択してください。');
      return false;
    }
    if (!uploadedImages[idx]) {
      alert('保存する画像がありません。');
      return false;
    }
    const base = fileName;
    const num = fileInfos[idx].padded;
    const name = `${base}_${num}.${fileExt}`;
    if (!dirHandleCell) dirHandleCell = await window.showDirectoryPicker();
    else {
      const ok = confirm(`「${dirHandleCell.name}」フォルダに「${name}」(同名は上書き)で保存しますか？`);
      if (!ok) {
        return false;
      }
    }

    if (!await checkPermission()) return;

    // 画像処理
    if (showMode !== 'processed') await setShowMode('processed');
    await prepareAndShowImage(idx);
    const imageData = processedImages[idx].processed;

    // エンコード
    let blob;
    if (fileExt === 'png') {
      blob = await encodePNG(imageData);
    } else if (fileExt === 'tif') {
      blob = await encodeTIFF(imageData);
    } else if (fileExt === 'tga') {
      blob = await encodeTGA(imageData);
    } else {
      throw new Error('Unsupported format: ' + fileExt);
    }

    // ダウンロード
    const fileHandle = await dirHandleCell.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    // 画面更新処理
    if (refresh) await prepareAndShowImage();
    return true;
  }

  const processAllImages = async function () {
    if (showMode !== 'processed') await setShowMode('processed');
    for (let i = 0; i < uploadedImages.length; i++) {
      await prepareAndShowImage(i);
    }
    await prepareAndShowImage();
    showStatus('全画像の処理を実行しました。', 'success', 3000);
  }

  const saveAllImages = async function () {
    // 確認処理
    if (fileName === '') {
      alert('ファイル名を入力してください。');
      fileNameInput.classList.add('blink');
      return;
    }
    if (fileExt === '') {
      alert('ファイル形式を選択してください。');
      return;
    }
    if (uploadedImages.length === 0) {
      alert('保存する画像がありません。');
      return;
    }
    if (!dirHandleCell) dirHandleCell = await window.showDirectoryPicker();
    else {
      const ok = confirm(`「${dirHandleCell.name}」フォルダに保存します。同じ名前のファイルは上書きされますが、よろしいですか？`);
      if (!ok) {
        return false;
      }
    }

    if (!await checkPermission()) return;

    // 画像処理
    await processAllImages();
    showStatus('<div class="loading"><div class="spinner"></div>画像ファイルを生成中...</div>');

    /** 全ての画像を保存 */
    for (let i = 0; i < processedImages.length; i++) {
      // エンコード
      const imageData = processedImages[i].processed;
      let blob;
      if (fileExt === 'png') {
        blob = await encodePNG(imageData);
      } else if (fileExt === 'tif') {
        blob = await encodeTIFF(imageData);
      } else if (fileExt === 'tga') {
        blob = await encodeTGA(imageData);
      } else {
        throw new Error('Unsupported format: ' + fileExt);
      }

      // ダウンロード
      const num = fileInfos[i].padded;
      const name = `${fileName}_${num}.${fileExt}`;
      const fileHandle = await dirHandleCell.getFileHandle(name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      showStatus(`<div class="loading"><div class="spinner"></div>画像ファイルを生成中...</div>${(i / processedImages.length * 100).toFixed(0)}%`);
    }

    await prepareAndShowImage();
    showStatus('保存が完了しました。', 'success', 3000);
  }

  const setDirHandle = async function () {
    dirHandle = await window.showDirectoryPicker();
    const permission = await checkPermission();

    if (permission) {
      // 1. dirHandle/_trace 内のフォルダを収集
      try {
        traceDirEntries.length = 0;
        const traceHandle = await dirHandle.getDirectoryHandle('_trace');
        for await (const [name, handle] of traceHandle.entries()) {
          if (handle.kind === 'directory') {
            traceDirEntries.push({ name: `_${name}`, handle });
          }
        }
      } catch (err) {
        console.warn('"_trace" フォルダが存在しないかアクセスできません:', err);
      }

      // 2. dirHandle 直下の "_" で始まらないフォルダを収集
      cellDirEntries.length = 0;
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'directory' && !name.startsWith('_trace')) {
          cellDirEntries.push({ name, handle });
        }
      }

      dirHandleTrace = traceDirEntries[0].handle;
      dirHandleCell = cellDirEntries[0].handle;
      window.FloatPanel.setRefDropdown(traceDirEntries.map(e => e.name));
      window.FloatPanel.setSavDropdown(cellDirEntries.map(e => e.name));

      window.CanvasEditor.uploadByDirHandle(dirHandleTrace);
    }


    return dirHandle;
  }

  const existDirHandle = function () {
    return (!!dirHandle);
  }

  const checkPermission = async function () {
    const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      const request = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (request !== 'granted') return false;
    }
    return true;
  }

  const setRefDirectory = function (e) {
    dirHandleTrace = traceDirEntries.find(ent => ent.name === e).handle;
    window.CanvasEditor.uploadByDirHandle(dirHandleTrace);
  }

  const setSavDirectory = function (e) {
    dirHandleCell = cellDirEntries.find(ent => ent.name === e).handle;
  }

  const setFileName = function (e) {
    fileName = e.trim();
  }

  const setFileExt = function (e) {
    fileExt = e;
  }

  window.FloatPanel.setSelectCutFolderCallBack(setDirHandle);
  window.FloatPanel.setRefDropdownCallBack(setRefDirectory);
  window.FloatPanel.setSavDropdownCallBack(setSavDirectory);
  window.FloatPanel.setFileNameInputCallBack(setFileName);
  window.FloatPanel.setFileExtListCallBack(setFileExt);
  window.FloatPanel.setSaveAllBtnCallBack(saveAllImages);
  // `float-panel.js`の`init`内で直接`setShowMode`を呼び出すように変更したため、以下の2行は不要になります。
  window.FloatPanel.setShowInCallBack(() => { setShowMode('original'); });
  window.FloatPanel.setShowOutCallBack(() => { setShowMode('processed'); });

  window.FloatPanel.setSharpnessBtnCallBack(() => { });
  window.FloatPanel.setDenoiseLevelListCallBack(() => { });
  window.FloatPanel.setCursorModeListCallBack(() => { });

  window.Core = {
    // 画像データ
    initImageDatas,
    setUploadedImage,
    getUploadedImage,
    setProcessedData,
    getProcessedData,
    setDrawImage,
    // モード
    setShowMode,
    getShowMode,
    setCursorMode,
    getCursorMode,
    setFrameIndex,
    getFrameIndex,
    // コンフィグ
    setGlobalConfig,
    getGlobalConfig,
    setFrameConfigs,
    getFrameConfig,
    checkLatest,
    clearFrameCfg,
    // 関数
    prepareAndShowImage,
    processAllImages,
    saveImage,
    setDirHandle,
    existDirHandle,
    setRefDirectory,
    setSavDirectory,
  }

  window.ConfigEditor.init();
  window.CanvasEditor.init();
  window.WebGPUProcessor.init();

})();
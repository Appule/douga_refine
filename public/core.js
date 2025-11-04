(function () {
  //// 状態管理
  // ファイルデータ
  let fileInfos = [];
  // 画像データ
  let uploadedImages = []; // アップロードした画像
  let processedImages = []; // 処理後画像の保持  [ { pressure:null, log:null, processed:null, hash:0, dhash:0, saved:false }, ... ]
  let drawImages = []; // マーキング画像
  let referenceImages = []; // 参照画像
  // モード
  let showMode = 'processed'; // 現在の描画モード enableSharpness: true, denoiseLevel: 3, enableDebug: false
  let cursorMode = 'camera'; // 現在のカーソルモード
  let frameIndex = 0; // 現在のフレーム番号
  let selectedThresholdIndex = 0; // config-editorで選択中のスライダーindex
  // コンフィグ
  let globalConfig = {}; // グローバルコンフィグ
  let frameConfigs = []; // フレームコンフィグ
  let dirHandle;
  let dirHandleTrace;

  // キーコンフィグ
  const keyConfig = {
    zoomIn: 'z',
    zoomOut: 'x',
    toggleShowMode: 'q',
    prevFrame: ',',
    nextFrame: '.',
  };

  let dirHandleCell;
  let traceDirEntries = [];
  let cellDirEntries = [];

  let panelsVisible = true;
  // window-global
  let fileName = '';
  let fileExt = 'tga';

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

    // パネルサイズを復元
    function loadPanelSizes() {
      const savedSizes = localStorage.getItem('panelSizes');
      if (savedSizes) {
        const panelSizes = JSON.parse(savedSizes);
        if (panelSizes.mainEditorPanelWidth) mainEditorPanel.style.width = panelSizes.mainEditorPanelWidth;
        if (panelSizes.frameMenuPanelWidth) frameMenuPanel.style.width = panelSizes.frameMenuPanelWidth;
        if (panelSizes.topContainerHeight) topContainer.style.height = panelSizes.topContainerHeight;
        if (panelSizes.colorEditorPanelHeight) colorEditorPanel.style.height = panelSizes.colorEditorPanelHeight;
      }
    }

    // パネルサイズを保存
    function savePanelSizes() {
      const panelSizes = {
        mainEditorPanelWidth: mainEditorPanel.style.width,
        frameMenuPanelWidth: frameMenuPanel.style.width,
        topContainerHeight: topContainer.style.height,
        colorEditorPanelHeight: colorEditorPanel.style.height,
      };
      localStorage.setItem('panelSizes', JSON.stringify(panelSizes));
    }

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
        savePanelSizes(); // リサイズ完了時にサイズを保存
      }
    });

    window.addEventListener('blur', () => {
      isResizingV = false;
      isResizingH = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    });

    window.addEventListener('resize', () => {
      // ウィンドウリサイズ時に垂直パネルの幅を再計算する
      const totalWidth = topContainer.offsetWidth;
      const mainWidth = mainEditorPanel.offsetWidth;
      const frameWidth = frameMenuPanel.offsetWidth;

      // 現在の幅の比率を計算して適用
      const mainPercentage = (mainWidth / (mainWidth + frameWidth)) * 100;
      const framePercentage = 100 - mainPercentage;
      mainEditorPanel.style.width = `${mainPercentage}%`;
      frameMenuPanel.style.width = `${framePercentage}%`;

      // ウィンドウリサイズ時に水平パネルの高さを再計算する
      const totalHeight = document.querySelector('.container').offsetHeight;
      const topHeight = topContainer.offsetHeight;
      const colorHeight = colorEditorPanel.offsetHeight;

      // 現在の高さの比率を計算して適用
      const topPercentage = (topHeight / (topHeight + colorHeight)) * 100;
      const colorPercentage = 100 - topPercentage;
      topContainer.style.height = `${topPercentage}%`;
      colorEditorPanel.style.height = `${colorPercentage}%`;
    });



    const response = await fetch('./_config/default.json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const defaultConfigFromFile = await response.json();

    loadPanelSizes(); // ページ読み込み時にサイズを復元

    const togglePanelsBtn = document.getElementById('togglePanelsBtn');
    togglePanelsBtn.addEventListener('click', () => {
      panelsVisible = !panelsVisible;
      if (panelsVisible) {
        frameMenuPanel.style.display = 'flex';
        colorEditorPanel.style.display = 'flex';
        resizerV.style.display = 'block';
        resizerH.style.display = 'block';
        mainEditorPanel.style.width = '80%'; // 元の幅に戻す
        topContainer.style.height = '80%'; // 元の高さに戻す
        loadPanelSizes();
      } else {
        frameMenuPanel.style.display = 'none';
        colorEditorPanel.style.display = 'none';
        resizerV.style.display = 'none';
        resizerH.style.display = 'none';
        mainEditorPanel.style.width = '100%';
        topContainer.style.height = '100%';
      }
    });
  });

  const loadImagesFromDrop = async function (files) {
    const fileInfos = createFileInfos(files);
    await loadAllImages(fileInfos);
  }

  // 画像データ setter/getter
  const initImageDatas = function (fis) {
    uploadedImages = new Array(fis.length);
    processedImages = new Array(fis.length).fill(0).map((_) => { return { pressure: null, log: null, processed: null, hash: '', dhash: '', saved: 0 } });
    drawImages = new Array(fis.length);
    referenceImages = new Array(fis.length);
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

  const setReferenceImage = function (img, idx = frameIndex) {
    referenceImages[idx] = img;
  }
  const getReferenceImage = function (idx = frameIndex) {
    return referenceImages[idx];
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
    if (showMode === 'reference' && referenceImages[i]) {
      window.CanvasEditor.showImg(referenceImages[i]);
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

      window.FloatPanel.setRefDropdown(traceDirEntries.map(e => e.name));
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

  const setRefDirectory = async function (e) {
    if (!e) return; // ダミーの選択肢が選ばれた場合は何もしない

    dirHandleTrace = traceDirEntries.find(ent => ent.name === e).handle;

    // 参照フォルダ名から保存先フォルダ名を作成 (例: '_A' -> 'A')
    const saveDirName = e.startsWith('_') ? e.substring(1) : e;
    const refDirName = saveDirName + ' - コピー';
    const saveDirEntry = cellDirEntries.find(ent => ent.name === saveDirName);
    const refDirEntry = cellDirEntries.find(ent => ent.name === refDirName);

    if (saveDirEntry) {
      dirHandleCell = saveDirEntry.handle;
    } else {
      console.warn(`保存先フォルダ "${saveDirName}" が見つかりません。`);
      // TODO: フォルダが見つからなかった場合の例外処理をここに追加
      // 例えば、ユーザーにフォルダ作成を促す、デフォルトの保存場所を使用するなど。
      dirHandleCell = null;
    }

    // 画像読み込み処理を統合
    await loadAllImages(dirHandleTrace, refDirEntry?.handle);
  }

  /**
   * Fileオブジェクトの配列からfileInfosを生成する
   * @param {File[]} files - Fileオブジェクトの配列
   * @returns {object[]} - fileInfoオブジェクトの配列
   */
  function createFileInfos(files) {
    return files
      .filter(f => f.type.startsWith("image/") || f.name.endsWith(".tga") || f.name.endsWith(".tif"))
      .map(f => {
        const baseNameOnly = f.name.replace(/\.[^/.]+$/, "");
        const lastUnderscore = baseNameOnly.lastIndexOf("_");
        const basename = lastUnderscore !== -1 ? baseNameOnly.substring(0, lastUnderscore) : baseNameOnly;
        const m = f.name.match(/(\d{4})/);
        const padded = m ? m[1] : "";
        const num = m ? parseInt(m[1], 10) : Infinity;
        return { file: f, padded, num, basename };
      })
      .sort((a, b) => a.num - b.num);
  }

  /**
   * 参照画像と参照（コピー）画像の両方を読み込み、状態を更新する
   * @param {FileSystemDirectoryHandle | object[]} source - 参照画像フォルダのハンドル or fileInfo配列
   * @param {FileSystemDirectoryHandle} [refSource=null] - 参照(コピー)画像フォルダのハンドル
   */
  async function loadAllImages(source, refSource = null) {
    showStatus('<div class="loading"><div class="spinner"></div>画像を読み込み中...</div>', 'info');
    try {
      let localFileInfos;

      // sourceがDirectoryHandleかfileInfo配列かで処理を分岐
      if (source.kind === 'directory') {
        const files = [];
        for await (const entry of source.values()) {
          if (entry.kind === 'file') files.push(await entry.getFile());
        }
        localFileInfos = createFileInfos(files);
      } else {
        localFileInfos = source;
      }

      if (localFileInfos.length === 0) {
        showStatus('選択されたフォルダに画像が見つかりませんでした。', 'error', 3000);
        window.CanvasEditor.resetCanvas();
        return;
      }

      // 状態とUIを初期化
      initImageDatas(localFileInfos);
      window.FloatPanel.updateFilenameInput(localFileInfos[0].basename);
      window.FrameManager.init(localFileInfos);

      // 参照（コピー）画像ファイルのマッピングを作成
      const refFileMap = new Map();
      if (refSource) {
        for await (const entry of refSource.values()) {
          if (entry.kind !== 'file') continue;
          const file = await entry.getFile();
          const m = file.name.match(/(\d{4})/);
          if (m) {
            const num = parseInt(m[1], 10);
            refFileMap.set(num, file);
          }
        }
      }

      // 全画像の読み込み
      for (let i = 0; i < localFileInfos.length; i++) {
        const info = localFileInfos[i];
        const ext = info.file.name.split('.').pop().toLowerCase();

        // uploadedImageの読み込み
        try {
          const imgData = await (ext === 'tga' ? window.ImageLoader.loadTGA(info.file) : (ext === 'tif' || ext === 'tiff' ? window.ImageLoader.loadTIFF(info.file) : window.ImageLoader.loadIMG(info.file)));
          setUploadedImage(imgData, i);

          // 最初の画像でCanvasをセットアップ
          if (i === 0) {
            window.CanvasEditor.setupCanvas(imgData);
            window.ConfigEditor.highlightColorBlock(selectedThresholdIndex);
          }

          // referenceImageの読み込み
          const refFile = refFileMap.get(info.num);
          if (refFile) {
            const refExt = refFile.name.split('.').pop().toLowerCase();
            const refImgData = await (refExt === 'tga' ? window.ImageLoader.loadTGA(refFile) : (refExt === 'tif' || refExt === 'tiff' ? window.ImageLoader.loadTIFF(refFile) : window.ImageLoader.loadIMG(refFile)));
            setReferenceImage(refImgData, i);
          }

        } catch (err) {
          console.error('Error loading image file:', err);
          showStatus(`画像の読み込みに失敗しました: ${info.file.name}`, 'error', 3000);
        }

        showStatus(`<div class="loading"><div class="spinner"></div>画像を読み込み中...${((i + 1) / localFileInfos.length * 100).toFixed(0)}%</div>`, 'info');
      }

      // 最初の画像を表示
      prepareAndShowImage();
      showStatus('画像の読み込みが完了しました。', 'success', 3000);

    } catch (err) {
      console.error('画像フォルダの読み込みに失敗しました:', err);
      showStatus('画像フォルダの読み込みに失敗しました。', 'error', 3000);
    }
  }

  const setFileName = function (e) {
    fileName = e.trim();
  }

  const setFileExt = function (e) {
    fileExt = e;
  }

  // float-panel.js Set Callback Function
  window.FloatPanel.setSelectCutFolderCallBack(setDirHandle);
  window.FloatPanel.setRefDropdownCallBack(setRefDirectory);
  window.FloatPanel.setFileNameInputCallBack(setFileName);
  window.FloatPanel.setFileExtListCallBack(setFileExt);
  window.FloatPanel.setSaveAllBtnCallBack(saveAllImages);

  window.FloatPanel.setShowInCallBack(() => { setShowMode('original'); });
  window.FloatPanel.setShowRefCallBack(() => { setShowMode('reference'); });
  window.FloatPanel.setShowOutCallBack(() => { setShowMode('processed'); });

  window.FloatPanel.setSharpnessBtnCallBack(() => { });
  window.FloatPanel.setDenoiseLevelListCallBack(() => { });
  window.FloatPanel.setCursorModeListCallBack((e) => { setCursorMode(e); });

  window.ConfigEditor.setClearConfigBtnCallBack(clearFrameCfg);
  window.ConfigEditor.setApplyConfigCallback((cfg, cfgToggleStates) => {
    if (cfgToggleStates.some(Boolean)) {
      setFrameConfigs(cfg, cfgToggleStates);
    } else {
      setGlobalConfig(cfg);
    }
  });

  window.Core = {
    loadImagesFromDrop,
    // 画像データ
    initImageDatas,
    setUploadedImage,
    getUploadedImage,
    setProcessedData,
    getProcessedData,
    setReferenceImage,
    getReferenceImage,
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
    // 関数
    prepareAndShowImage,
    processAllImages,
    saveImage,
    setDirHandle,
    existDirHandle,
  }

  // --- キーボードショートカット ---
  document.addEventListener('keydown', (e) => {
    // Ignore when typing in inputs/textareas
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

    const key = e.key;
    const isAlt = e.altKey;
    const isShift = e.shiftKey;

    // 修飾キーが押されている場合は無視 (Altを除く)
    // ただし、Shiftキーは一部のショートカットで使用するため、ここではShift単体は除外しない
    if (e.ctrlKey || e.metaKey) {
      return;
    }

    // Shiftキーが押されている場合の特別処理
    if (isShift) {
      // ただし、Frame-manager.jsの 'Shift+<' or 'Shift+>' は '<' or '>' として扱われるため、ここでは無視しない
      if (!(key === '<' || key === '>')) {
        // 他のShiftキー組み合わせショートカットがなければ、ここでreturnしても良い
      }
    }

    // Shiftキーが押されていない場合
    if (!isShift && (key === '<' || key === '>')) {
      // '<' or '>' 単体の場合の処理（FrameManagerで処理される）
    }

    // ズーム
    if (key.toLowerCase() === keyConfig.zoomIn) {
      e.preventDefault();
      window.CanvasEditor.changeZoomStep(1);
      return;
    }
    if (key.toLowerCase() === keyConfig.zoomOut) {
      e.preventDefault();
      window.CanvasEditor.changeZoomStep(-1);
      return;
    }

    // 表示モード切替
    if (key.toLowerCase() === keyConfig.toggleShowMode) {
      e.preventDefault();
      const currentMode = getShowMode();
      if (currentMode === 'processed') {
        setShowMode('original');
      } else {
        setShowMode('processed');
      }
      return;
    }
    if (key.toLowerCase() === 'w') {
      e.preventDefault();
      setShowMode('reference');
      return;
    }
    if (key.toLowerCase() === 'e') {
      e.preventDefault();
      setShowMode('processed');
      return;
    }

    // フレーム移動
    if (key === keyConfig.prevFrame || key === '<') {
      e.preventDefault();
      window.FrameManager.changeFrame(isAlt ? 'first' : 'prev');
      return;
    }
    if (key === keyConfig.nextFrame || key === '>') {
      e.preventDefault();
      window.FrameManager.changeFrame(isAlt ? 'last' : 'next');
      return;
    }

    // 投げ縄のアルファ値変更
    if (/^[0-9]$/.test(key)) {
      const cmode = getCursorMode();
      if (cmode === 'highTh' || cmode === 'lowTh') {
        e.preventDefault();
        window.CanvasEditor.setFillAlphaFromKey(key);
        return;
      }
    }

    // Thresholdスライダーのショートカット
    const keyLower = key.toLowerCase();
    if (keyLower === 'a' || keyLower === 'd') {
      e.preventDefault();
      const maxIndex = window.ConfigEditor.getColorBlockCount() - 1;
      if (keyLower === 'a') {
        selectedThresholdIndex = Math.max(0, selectedThresholdIndex - 1);
      } else { // 'd'
        selectedThresholdIndex = Math.min(maxIndex, selectedThresholdIndex + 1);
      }
      window.ConfigEditor.highlightColorBlock(selectedThresholdIndex);

      if (!panelsVisible) {
        const info = window.ConfigEditor.getColorBlockInfo(selectedThresholdIndex);
        if (info) {
          showStatus(`<span style="color: ${info.labelColor}; font-weight: bold;">選択中: Color ${selectedThresholdIndex + 1}</span>`, 'info', 1500);
        }
      }
      return;
    }

    if (keyLower === 'r' || keyLower === 'f') {
      e.preventDefault();
      const delta = (keyLower === 'r') ? 1 : -1;
      const amount = isShift ? delta * 5 : delta;
      window.ConfigEditor.updateThresholdSlider(selectedThresholdIndex, amount);
      return;
    }


    // パネル表示切替
    if (key === '/') {
      e.preventDefault();
      document.getElementById('togglePanelsBtn')?.click();
      return;
    }
  });

  window.ConfigEditor.init();
  window.CanvasEditor.init();
  window.WebGPUProcessor.init();

})();
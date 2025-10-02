(function(){
  // ファイルデータ
  let fileInfos = [];
  // 画像データ
  let uploadedImages = []; // アップロードした画像
  let processedImages = []; // 処理後画像の保持  [ { pressure:null, log:null, processed:null, hash:0, saved:false }, ... ]
  let drawImages = []; // マーキング画像
  // モード
  let showMode = 'processed'; // 現在の描画モード
  let cursorMode = 'camera'; // 現在のカーソルモード
  let frameIndex = 0; // 現在のフレーム番号
  // コンフィグ
  let globalConfig = {}; // グローバルコンフィグ
  let frameConfigs = []; // フレームコンフィグ

  //// HTML要素
  // ページ設定
  document.addEventListener('DOMContentLoaded', () => {

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
  });

  // 画像データ setter/getter
  const initImageDatas = function(fis){
    uploadedImages = new Array(fis.length);
    processedImages = new Array(fis.length).fill(0).map((_)=>{return { pressure:null, log:null, processed:null, hash:'', saved:0 }});
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

  const setUploadedImage = function(img, idx = frameIndex){ 
    uploadedImages[idx] = img;
  }
  const getUploadedImage = function(idx = frameIndex){ 
    return uploadedImages[idx];
  }

  const setProcessedData = function(data, idx = frameIndex){ 
    processedImages[idx].pressure = data.pressure;
    processedImages[idx].log = data.log;
    processedImages[idx].processed = data.processed;
  }
  const getProcessedData = function(idx = frameIndex){ 
    return processedImages[idx];
  }

  const setDrawImage = async function(img, idx = frameIndex){
    const hash = await getImageDataHash(img);
    drawImages[idx] = {img, hash};
    
    prepareAndShowImage(idx);
  }

  // モード setter/getter
  const setShowMode = function(mode){
    showMode = mode;
    if(cursorMode == 'camera' || mode != 'processed') window.CanvasEditor.hideDrawCanvas();
    else window.CanvasEditor.showDrawCanvas();
    prepareAndShowImage();
  }
  const getShowMode = function(){ return showMode; }

  const setCursorMode = function(mode){
    cursorMode = mode;
    if(mode == 'camera' || showMode != 'processed') window.CanvasEditor.hideDrawCanvas();
    else window.CanvasEditor.showDrawCanvas();
  }
  const getCursorMode = function(){ return cursorMode; }

  const setFrameIndex = function(idx){
    frameIndex = idx;
    window.CanvasEditor.drawImg(drawImages[idx]);
    prepareAndShowImage();
  }
  const getFrameIndex = function(){ return frameIndex; }
  
  // コンフィグ setter/getter
  const setGlobalConfig = function(cfg){
    globalConfig = cfg;
    prepareAndShowImage();
  }
  const getGlobalConfig = function(){ return JSON.parse(JSON.stringify(globalConfig)); }

  const setFrameConfigs = function(cfg, toggles){
    for(let i = 0; i < frameConfigs.length; ++i) {
      if(toggles[i]) {
        frameConfigs[i] = cfg;
        window.FrameManager.drawGear(i);
      }
    }
    prepareAndShowImage();
  }
  const getFrameConfig = function(idx = frameIndex){
    return frameConfigs[idx];
  }

  const checkLatest = function(idx){ return frameConfigs[idx] ? frameConfigs[idx].hash == processedImages[idx].hash : globalConfig.hash == processedImages[idx].hash }

  const clearFrameCfg = function(){
    const toggles = window.FrameManager.getCfgToggleStates();
    for(let i = 0; i < frameConfigs.length; ++i){
      if(toggles[i]) {
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
    if (cfgToUse.hash != processedImages[i].hash) {
      await window.WebGPUProcessor.processImage(uploadedImages[i], drawImages[i], cfgToUse, i);
      processedImages[i].hash = cfgToUse.hash;
    }

    const procImg = processedImages[i][showMode];
    if (procImg) {
      window.CanvasEditor.showImg(procImg);
      window.CanvasEditor.drawImg(drawImages[i]);
    }

    // ボタンのスタイルを更新
    window.FrameManager.updateFrameButtons();
  }

  const saveImage = async function(idx, refresh) {
    // 確認処理
    const fileName = window.FloatPanel.getFileName();
    const fileFormat = window.FloatPanel.getFileExt();
    if (fileName === '') {
      alert('ファイル名を入力してください。');
      return false;
    }
    if (fileFormat === '') {
      alert('ファイル形式を選択してください。');
      return false;
    }
    if (!uploadedImages[idx]) {
      alert('保存する画像がありません。');
      return false;
    }
    const base = fileName;
    const num  = fileInfos[idx].padded;
    const name = `${base}_${num}.${fileFormat}`;
    const ok = confirm(`「${name}」という名前で保存しますか？`);
    if (!ok) {
      return false; // キャンセルされたら処理を中止
    }

    // 画像処理
    if(showMode !== 'processed') await setShowMode('processed');
    await prepareAndShowImage(idx);
    const imageData = processedImages[idx].processed;

    // エンコード
    let blob;
    if (fileFormat === 'png') {
      blob = await encodePNG(imageData);
    } else if (fileFormat === 'tif') {
      blob = await encodeTIFF(imageData);
    } else if (fileFormat === 'tga') {
      blob = await encodeTGA(imageData);
    } else {
      throw new Error('Unsupported format: ' + fileFormat);
    }

    // ダウンロード
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    // 画面更新処理
    if(refresh) await prepareAndShowImage();
    return true;
  }

  const processAllImages = async function(){
    if(showMode !== 'processed') await setShowMode('processed');
    for (let i = 0; i < uploadedImages.length; i++) {
      await prepareAndShowImage(i);
    }
    await prepareAndShowImage();
    showStatus('全画像の処理を実行しました。', 'success', 3000);
  }
  
  const saveAllImages = async function() {
    // 確認処理
    const fileName = window.FloatPanel.getFileName();
    const fileFormat = window.FloatPanel.getFileExt();
    if (fileName === '') {
      alert('ファイル名を入力してください。');
      fileNameInput.classList.add('blink');
      return;
    }
    if (fileFormat === '') {
      alert('ファイル形式を選択してください。');
      return;
    }
    if (uploadedImages.length === 0) {
      alert('保存する画像がありません。');
      return;
    }
    const ok = confirm(`「${fileName}_XXXX.${fileFormat}」という名前で保存しますか？`);
    if (!ok) {
      return;
    }
    
    // 画像処理
    const images = processedImages;
    let allProcessed = false;
    for (let j = 0; j < uploadedImages.length; j++) {
      if (!images[j]?.processed || configPhase != images[j]?.phase) {
        allProcessed = false;
        break;
      }
      allProcessed = true;
    }
    if(!allProcessed){
      await processAllImages();
    }
    showStatus('ZIPファイルを生成中...', 'info');

    for (let i = 0; i < processedImages.length; i++) {
      // エンコード
      const imageData = processedImages[i].processed;
      let blob;
      if (fileFormat === 'png') {
        blob = await encodePNG(imageData);
      } else if (fileFormat === 'tif') {
        blob = await encodeTIFF(imageData);
      } else if (fileFormat === 'tga') {
        blob = await encodeTGA(imageData);
      } else {
        throw new Error('Unsupported format: ' + fileFormat);
      }

      // ダウンロード
      const num  = fileInfos[i].padded;
      const name = `${fileName}_${num}.${fileFormat}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if(i < processedImages.length - 1) await delay(200);
    }

    await prepareAndShowImage();
    showStatus('ZIPファイルの保存が完了しました。', 'success', 3000);
  }

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
    saveAllImages,
  }

  window.ConfigEditor.init();
  window.CanvasEditor.init();
  window.WebGPUProcessor.init();

})();
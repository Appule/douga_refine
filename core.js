(function(){
  // 画像データ
  let uploadedImages = []; // アップロードした画像
  let processedImages = [{ pressure:null, log:null, processed:null, phase:0 }]; // 処理後画像の保持
  let drawImages = []; // マーキング画像
  // モード
  let showMode = 'processed'; // 現在の描画モード
  let cursorMode = 'camera'; // 現在のカーソルモード
  let frameIndex = 0; // 現在のフレーム番号
  // コンフィグ
  let globalConfig = { }; // グローバルコンフィグ
  let frameConfigs = [ ]; // フレームコンフィグ
  let configPhase = 0; // コンフィグの更新状態

  //// HTML要素
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
    });

    window.addEventListener('blur', () => {
      isResizingV = false;
      isResizingH = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    });
  });

  window.CanvasEditor.init();

  // 画像データ setter/getter
  const initImageDatas = function(num){
    uploadedImages = new Array(num);
    processedImages = new Array(num).fill(0).map((_)=>{return { pressure:null, log:null, processed:null, phase:0 }});
    drawImages = new Array(num);
  }

  const setUploadedImage = function(img, idx = null){ 
    idx = idx || frameIndex;
    uploadedImages[idx] = img;
  }
  const getUploadedImage = function(idx = null){ 
    idx = idx || frameIndex;
    return uploadedImages[idx];
  }

  const setProcessedData = function(data, idx = null){ 
    idx = idx || frameIndex;
    processedImages[idx].pressure = data.pressure;
    processedImages[idx].log = data.log;
    processedImages[idx].processed = data.processed;
    processedImages[idx].phase = data.phase;
  }
  const getProcessedData = function(idx = null){ 
    idx = idx || frameIndex;
    return processedImages[idx];
  }

  const setDrawImage = function(img, idx = null){ 
    idx = idx || frameIndex;
    drawImages[idx] = img;
    
    processedImages[idx].phase--;
    prepareAndShowImage(idx);
  }
  const getDrawImage = function(idx = null){ 
    idx = idx || frameIndex;
    return drawImages[idx];
  }

  // モード setter/getter
  const setShowMode = function(mode){
    showMode = mode;
    prepareAndShowImage();
  }
  const getShowMode = function(){ return showMode; }

  const setCursorMode = function(mode){
    cursorMode = mode;
  }
  const getCursorMode = function(){ return cursorMode; }

  const setFrameIndex = function(idx){
    frameIndex = idx;
    prepareAndShowImage();
  }
  const getFrameIndex = function(){ return frameIndex; }
  
  // コンフィグ setter/getter
  const setGlobalConfig = function(cfg){
    globalConfig = cfg;
    configPhase++;
    prepareAndShowImage();
  }
  const getGlobalConfig = function(){ return globalConfig; }

  const setFrameConfigs = function(cfg, toggles){
    frameConfigs.forEach((fc, i) => {
      if(toggles[i]) {
        fc = cfg;
        window.FrameManager.frameBtns[i].cbtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
        processedImages[i].phase--;
      }
    });
    prepareAndShowImage();
  }
  const getFrameConfigs = function(){ return frameConfigs; }

  const incrementPhase = function(){ 
    configPhase++; 
    prepareAndShowImage();
  }
  const getConfigPhase = function(){ return configPhase; }
  const checkPhase = function(idx) { return processedImages[idx]?.phase && (processedImages[idx].phase === configPhase);}


  // 画像処理・描画関数
  async function prepareAndShowImage(idx = null) {
    const i = idx || frameIndex;
    if (!uploadedImages[i]) return;

    if (showMode === 'original') {
      window.CanvasEditor.drawImg(uploadedImages[i]);
      return;
    }

    // If the processed image is out-of-date or missing, generate it.
    if (configPhase != processedImages[i].phase) {
      const cfgToUse = (frameConfigs && frameConfigs[i]) ? frameConfigs[i] : globalConfig;
      await processImage(uploadedImages[i], drawImages[i], cfgToUse, i);
    }

    const procImg = processedImages[i][showMode];
    if (procImg) {
      window.CanvasEditor.drawImg(procImg);
    }

    // ボタンのスタイルを更新
    window.FrameManager.updateFrameButtons();
  }

  initWebGPU();

  window.Core = {
    // 画像データ
    initImageDatas,
    setUploadedImage,
    getUploadedImage,
    setProcessedData,
    getProcessedData,
    setDrawImage,
    getDrawImage,
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
    getFrameConfigs,
    incrementPhase,
    getConfigPhase,
    checkPhase,
    // 関数
    prepareAndShowImage,
  }



})();
(function() {
  // エディター画面 (中央エリア)
  const editorContent = document.querySelector(".editor-content");
  const dropZone = document.getElementById("drop-zone");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const drawCanvas = document.getElementById("drawCanvas");
  const dctx = drawCanvas.getContext('2d', { willReadFrequently: true });
  const overlayCanvas = document.getElementById("overlayCanvas");
  const octx = overlayCanvas.getContext('2d', { willReadFrequently: true });
  const offscreenCanvas = document.getElementById("offscreenCanvas");
  const osctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

  // カメラワーク / 範囲選択処理
  let zoom = 1;
  const zoomLevels = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  let offsetX = 0, offsetY = 0;
  let isDragging = false;
  let startX, startY;
  let isLassoing   = false;
  let lassoPoints  = [];

  const init = function(){
    // dragoverイベントでdrop許可
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragover");
    });

    // 画像アップロードイベント
    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      showStatus('画像を読み込み中...', 'info');
      dropZone.classList.remove("dragover");
  
      // ex) A_0001~0088 => [{ file, num:0001~0088, num:1~88, basename:A }, ...]
      const fileInfos = Array.from(e.dataTransfer.files)
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
      window.FloatPanel.updateFilenameInput(fileInfos[0].basename);
  
      // 画像データキャッシュ配列を生成
      window.Core.initImageDatas(fileInfos.length);
  
      // フレームメニューを初期化
      window.FrameManager.init(fileInfos);
  
      // キャンバスとキャッシュ画像を初期化
      await initCanvas(fileInfos);
  
      // 読み込み完了後に描画処理
      window.Core.prepareAndShowImage();
    });

    canvas.style.transformOrigin = "0 0"; // 左上基準
    drawCanvas.style.transformOrigin = "0 0";
    overlayCanvas.style.transformOrigin = "0 0";

    editorContent.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    editorContent.addEventListener("mousedown", (e) => {
      if (window.Core.getCursorMode() !== 'camera') return;
      if (e.button === 1) { // 中ボタンでリセット
        resetCanvasOffset();
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
      if (window.Core.getCursorMode() !== 'camera' || !isDragging) return;
      offsetX = e.clientX - startX;
      offsetY = e.clientY - startY;
      updateTransform();
    });

    editorContent.addEventListener("mouseup", () => {
      if (window.Core.getCursorMode() !== 'camera') return;
      isDragging = false;
    });

    // 投げ縄開始
    editorContent.addEventListener('mousedown', e => {
      if (window.Core.getCursorMode() !== 'highTh' && window.Core.getCursorMode() !== 'lowTh') return;

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
    
    
    // Keyboard shortcuts: zoom
    document.addEventListener('keydown', (e) => {
      // Ignore when typing in inputs/textareas
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      const key = e.key;
      const isShift = e.shiftKey;

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
    });
  }
  
  // 画像アップロード時
  const initCanvas = async function(fileInfos){
    // 各ファイルの処理
    for (let index = 0; index < fileInfos.length; index++) {
      const info = fileInfos[index];
      const ext = info.file.name.split('.').pop().toLowerCase();
      // Obtain ImageData from file (TGA/TIFF/other) then draw to canvas & cache
      try {
        let imgData;
        if (ext === 'tga') {
          imgData = await window.ImageLoader.loadTGA(info.file);
        } else if (ext === 'tif' || ext === 'tiff') {
          imgData = await window.ImageLoader.loadTIFF(info.file);
        } else {
          imgData = await window.ImageLoader.loadIMG(info.file);
        }
  
        // イメージデータを保存
        window.Core.setUploadedImage(imgData, index);
        
        if (index === 0) {
          // キャンバスサイズを最初の画像サイズに設定
          canvas.width = imgData.width;
          canvas.height = imgData.height;
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
          
          resetCanvasOffset();
          
          dctx.fillStyle = '#FFFFFF';
          dctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
        }
  
        if (index === fileInfos.length - 1) {
          showStatus(`${ext.toUpperCase()}画像が読み込まれました。`, 'success', 3000);
        }
  
      } catch (err) {
        console.error('Error loading image file:', err);
        showStatus(`画像の読み込みに失敗しました: ${info.file.name}`, 'error', 3000);
      }
    }
    
    // 最初の文言を削除
    const h1 = editorContent.querySelector('h1');
    const p = editorContent.querySelector('p');
    if (h1) h1.remove();
    if (p) p.remove();
    editorContent.style.alignItems = 'initial';
  }
  

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

  function setZoom(newZoom, centerX = null, centerY = null) {
    const prevZoom = zoom;
    zoom = newZoom;

    if (centerX !== null && centerY !== null) {
      offsetX = centerX - (centerX - offsetX) * (zoom / prevZoom);
      offsetY = centerY - (centerY - offsetY) * (zoom / prevZoom);
    }

    updateTransform();
  }

  function changeZoomStep(delta, centerX = null, centerY = null) {
    const idx = findClosestZoomIndex(zoom);
    let nextIdx = idx + delta;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx >= zoomLevels.length) nextIdx = zoomLevels.length - 1;
    const newZoom = zoomLevels[nextIdx];
    setZoom(newZoom, centerX, centerY);
  }

  function resetCanvasOffset(){
    offsetX = 0;
    offsetY = 0;
    zoom = 1;
    canvas.style.transform = `translate(0px, 0px) scale(1)`;
    drawCanvas.style.transform = `translate(0px, 0px) scale(1)`;
    overlayCanvas.style.transform = `translate(0px, 0px) scale(1)`;
  }

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
      fillColor = window.Core.getCursorMode() == 'highTh' ? 'rgb(255, 0, 0, 0.1)' : 'rgb(0, 0, 255, 0.1)';
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

    window.Core.setDrawImage(dctx.getImageData(0, 0, canvas.width, canvas.height));
  }

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


  const drawImg = function(img){
    ctx.putImageData(img, 0, 0);
  }

  //// 共有オブジェクト
  window.CanvasEditor = {
    init,
    drawImg,
  }

})();
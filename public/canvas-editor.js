(function () {
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
  const zoomLevels = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20];
  let offsetX = 0, offsetY = 0;
  let isDragging = false;
  let startX, startY;
  let isLassoing = false;
  let lassoPoints = [];
  // Fill alpha (0.1 .. 1.0) adjustable by pressing keys 1..9 and 0 (0 -> 1.0)
  let fillAlpha = 0.1;
  let mouseX = 0, mouseY = 0;
  // current pixel color under cursor (RGBA 0-255)
  let currentPixelColor = { r: 0, g: 0, b: 0, a: 0 };

  const init = function () {
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
      dropZone.classList.remove("dragover");
      // ex) A_0001~0088 => [{ file, num:0001~0088, num:1~88, basename:A }, ...]
      window.Core.loadImagesFromDrop(Array.from(e.dataTransfer.files));
    });

    canvas.style.transformOrigin = "0 0"; // 左上基準
    drawCanvas.style.transformOrigin = "0 0";
    overlayCanvas.style.transformOrigin = "0 0";

    editorContent.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    editorContent.addEventListener("mousedown", (e) => {
      if (window.Core.getCursorMode() !== 'camera') return;
      if (e.button === 0 || e.button === 1) {
        if (e.button === 0) applyColorToActiveToggle(e);
        isDragging = true;
        startX = e.clientX - offsetX;
        startY = e.clientY - offsetY;
      } else if (e.button === 2) {
        const toggles = document.querySelectorAll('.color-toggle');
        toggles.forEach(toggle => {
          if (toggle.classList.contains('active')) {
            toggle.classList.remove('active');
          }
        });
      }
    });

    document.addEventListener("mousemove", (e) => {
      const containerRect = editorContent.getBoundingClientRect();
      mouseX = e.clientX - containerRect.left;
      mouseY = e.clientY - containerRect.top;

      if (!isDragging) return;
      offsetX = e.clientX - startX;
      offsetY = e.clientY - startY;
      updateTransform();
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });

    // 投げ縄開始
    editorContent.addEventListener('mousedown', e => {
      if (e.button === 1) {
        isDragging = true;
        startX = e.clientX - offsetX;
        startY = e.clientY - offsetY;
      } else {
        if (window.Core.getCursorMode() !== 'highTh' && window.Core.getCursorMode() !== 'lowTh') return;

        isLassoing = true;
        lassoPoints = [screenToCanvas(e.clientX, e.clientY)];

        // overlay をクリアしてパスをリセット
        octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
    });

    // マウス移動でパスを追加＆プレビュー描画
    editorContent.addEventListener('mousemove', e => {
      if (!isLassoing) return;

      lassoPoints.push(screenToCanvas(e.clientX, e.clientY));
      drawLassoOverlay();
    });

    // 投げ縄確定（塗りつぶし）
    editorContent.addEventListener('mouseup', e => {
      if (!isLassoing) return;
      isLassoing = false;

      let fillMode;
      if (e.button === 0)
        fillMode = 'fill';
      else if (e.button === 2)
        fillMode = 'erase';
      fillLassoRegion(fillMode);
      octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    });

    editorContent.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (isDragging) return;
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

  }

  /**
   * 最初の画像データに基づいてCanvasのサイズを初期化・設定します。
   * @param {ImageData} firstImageData - フレームシーケンスの最初の画像データ。
   */
  const setupCanvas = function (firstImageData) {
    if (firstImageData) {
      // キャンバスサイズを最初の画像サイズに設定
      const { width, height } = firstImageData;
      [canvas, drawCanvas, overlayCanvas, offscreenCanvas].forEach(c => {
        c.width = width;
        c.height = height;
        if (c !== offscreenCanvas) {
          c.style.width = width + 'px';
          c.style.height = height + 'px';
        }
      });

      resetCanvasOffset();

      dctx.save();
      dctx.fillStyle = '#FFFFFF';
      dctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
      dctx.restore();

      // 最初の文言を削除
      const h1 = editorContent.querySelector('h1');
      const p = editorContent.querySelector('p');
      if (h1) h1.remove();
      if (p) p.remove();
      editorContent.style.alignItems = 'initial';
      editorContent.style.justifyContent = 'initial';
    }
  }

  const resetCanvas = function () {
    // 既存のCanvasをクリアし、初期メッセージを再表示
    [ctx, dctx, octx, osctx].forEach(c => c.clearRect(0, 0, c.canvas.width, c.canvas.height));
    canvas.width = canvas.height = 0;
    canvas.style.width = '0px';
    canvas.style.height = '0px';
    // ... 他のCanvasも同様にリセット ...

    editorContent.innerHTML = `
      <h1>編集画面</h1>
      <p>「カットフォルダ」から作業フォルダを選択してください</p>
    `;
    editorContent.appendChild(canvas);
    editorContent.appendChild(drawCanvas);
    editorContent.appendChild(overlayCanvas);
    editorContent.appendChild(offscreenCanvas);
    editorContent.style.alignItems = 'center';
    editorContent.style.justifyContent = 'center';
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

  function changeZoomStep(delta) {
    const containerRect = editorContent.getBoundingClientRect();
    const centerX = mouseX - containerRect.left;
    const centerY = mouseY - containerRect.top;

    const idx = findClosestZoomIndex(zoom);
    let nextIdx = idx + delta;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx >= zoomLevels.length) nextIdx = zoomLevels.length - 1;
    const newZoom = zoomLevels[nextIdx];
    setZoom(newZoom, centerX, centerY);

    updateTransform();
  }

  function resetCanvasOffset() {
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
    octx.lineWidth = 2 / zoom;              // ズーム補正
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
      // Use fillAlpha (adjustable via number keys) and proper rgba() string
      fillColor = window.Core.getCursorMode() == 'highTh'
        ? `rgba(255,0,0,${fillAlpha})`
        : `rgba(0,0,255,${fillAlpha})`;
    } else if (mode == 'erase') {
      fillColor = 'rgba(255,255,255,1.0)';
    } else {
      fillColor = 'rgba(255,255,255,1.0)';
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
    if (zoom >= 1.0) {
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

  function updatePixelColorAtMouse(clientX, clientY) {
    const pt = screenToCanvas(clientX, clientY);
    const x = Math.floor(pt.x);
    const y = Math.floor(pt.y);

    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
      currentPixelColor = { r: 0, g: 0, b: 0, a: 0 };
      return currentPixelColor;
    }

    const imageData = ctx.getImageData(x, y, 1, 1).data;
    currentPixelColor = { r: imageData[0], g: imageData[1], b: imageData[2], a: imageData[3] };
    return currentPixelColor;
  }

  function applyColorToActiveToggle(e) {
    // 1. ピクセル色を取得
    const { r, g, b, a } = updatePixelColorAtMouse(e.clientX, e.clientY);
    // 2. .color-toggle のうち active な要素を探す
    const toggles = document.querySelectorAll('.color-toggle');
    toggles.forEach(toggle => {
      if (toggle.classList.contains('active')) {
        // 3. 隣の color input を取得（nextElementSibling などで）
        const colorInput = toggle.nextElementSibling;
        if (colorInput && colorInput.type === 'color') {
          // 4. 値を更新
          const toHex = (v) => v.toString(16).padStart(2, '0');
          if (e.shiftKey) {
            const currentRgb = hexToRgb(colorInput.value);
            const avgR = Math.round((currentRgb.r + r) / 2);
            const avgG = Math.round((currentRgb.g + g) / 2);
            const avgB = Math.round((currentRgb.b + b) / 2);
            const hexColor = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;
            colorInput.value = hexColor;
          } else {
            toggle.classList.remove('active');
            const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
            colorInput.value = hexColor;
          }
          // 5. change イベントを発火
          const event = new Event('change', { bubbles: true });
          colorInput.dispatchEvent(event);
        }
      }
    });
  }

  const showImg = function (img) {
    if (img) ctx.putImageData(img, 0, 0);
  }
  const drawImg = function (data) {
    if (data?.img) dctx.putImageData(data.img, 0, 0);
    else {
      dctx.save();
      dctx.fillStyle = '#FFFFFF';
      dctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
      dctx.restore();
    }
  }

  const hideDrawCanvas = function () { drawCanvas.hidden = true; }
  const showDrawCanvas = function () { drawCanvas.hidden = false; }

  const setFillAlphaFromKey = function (key) {
    const n = key === '0' ? 10 : parseInt(key, 10);
    fillAlpha = Math.max(0.1, Math.min(1.0, n / 10));
    if (typeof showStatus === 'function') {
      showStatus(`Fill alpha set to ${fillAlpha.toFixed(1)}`, 'info', 1000);
    }
  }

  //// 共有オブジェクト
  window.CanvasEditor = {
    init,
    showImg,
    drawImg,
    hideDrawCanvas,
    showDrawCanvas,
    setupCanvas,
    resetCanvas,
    changeZoomStep,
    setFillAlphaFromKey,
  }

})();
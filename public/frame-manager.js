(function () {
  // フレームメニュー (右エリア)
  const menuContent = document.querySelector(".menu-content");
  const previewCanvas = document.getElementById('previewCanvas');
  const pctx = previewCanvas.getContext('2d');

  let frameBtns = []; // フレームボタン用
  let buttonIsPressed = false;
  let cfgIsPressed = false;
  let frameCfgIndex = 0; // 現在のコンフィグフレーム番号
  let cfgToggleStates = []; // コンフィグボタンのトグル状態

  const init = function (fileInfos) {

    menuContent.innerHTML = '';
    frameBtns = new Array(fileInfos.length);
    cfgToggleStates = new Array(fileInfos.length).fill(false);

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
        cfgToggleStates.fill(false);
        if (cbtn.innerHTML) cfgToggleStates[index] = true;
        frameCfgIndex = index;
        updateCfgBtns();
        window.Core.setFrameIndex(index);
        await window.Core.prepareAndShowImage(index);
        // frameIndexのボタンを強調表示
        accentFrmBtn(index);
      });
      fbtn.addEventListener("mouseenter", async () => {
        if (buttonIsPressed) {
          fbtn.classList.add('active');
          cfgToggleStates.fill(false);
          if (cbtn.innerHTML) cfgToggleStates[index] = true;
          frameCfgIndex = index;
          updateCfgBtns();
          window.Core.setFrameIndex(index);
          await window.Core.prepareAndShowImage(index);
          // frameIndexのボタンを強調表示
          accentFrmBtn(index);
        }
        // プレビュー
        const imgData = window.Core.getUploadedImage(index);
        if (!imgData) return;
        const bitmap = await createImageBitmap(imgData);
        const h = 150;
        const w = Math.round(bitmap.width * (h / bitmap.height));
        if (previewCanvas.width != w || previewCanvas.height != h) {
          previewCanvas.width = w;
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

      // コンフィグボタン 'rgba(230, 129, 71, 1)'
      const cbtn = document.createElement("button");
      cbtn.classList.add("config-btn");
      cbtn.innerHTML = '';
      cbtn.addEventListener("mousedown", (event) => {
        if (event.button == 0) {
          cfgIsPressed = true;
          cbtn.classList.add('active');
          if (event.shiftKey) {
            cfgToggleStates.fill(false);
            for (let i = Math.min(index, frameCfgIndex); i <= Math.max(index, frameCfgIndex); i++) {
              cfgToggleStates[i] = true;
            }
          }
          else if (event.ctrlKey) {
            cfgToggleStates[index] = !cfgToggleStates[index];
            frameCfgIndex = index;
          }
          else {
            cfgToggleStates.fill(false);
            cfgToggleStates[index] = true;
            frameCfgIndex = index;
          }
        }
        else if (event.button == 2) {
          cfgIsPressed = false;
          cfgToggleStates.fill(false);
        }
        updateCfgBtns();
      });
      cbtn.addEventListener("mouseenter", (event) => {
        if (cfgIsPressed) {
          if (!event.ctrlKey) cfgToggleStates.fill(false);
          for (let i = Math.min(index, frameCfgIndex); i <= Math.max(index, frameCfgIndex); i++) {
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

      // 個別保存ボタン 'rgba(44, 222, 235, 1)'
      const sbtn = document.createElement("button");
      sbtn.classList.add("save-btn");
      sbtn.innerHTML = '<i class="fas fa-file-download"></i>';
      sbtn.addEventListener("click", async () => {
        if (await window.Core.saveImage(index, true)) sbtn.classList.replace("save-btn", "saved-btn");
      });
      row.appendChild(sbtn);

      // ボタン列
      frameBtns[index] = { fbtn, cbtn };
      menuContent.appendChild(row);
    });
    accentFrmBtn(window.Core.getFrameIndex());
  }

  // フレームボタンをハイライト
  function accentFrmBtn(index) {
    frameBtns.forEach((b, i) => {
      if (i === index) {
        b.fbtn.classList.add('accent');
      }
      else {
        b.fbtn.classList.remove('accent');
      }
    });
  }

  // コンフィグボタンの更新
  const colorEditorTitle = document.getElementById("color-editor-title");
  function updateCfgBtns() {
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
    // カラー編集のタイトル更新
    if (noActive) {
      colorEditorTitle.innerHTML = 'カラー編集 ⇒ <i class="fa-solid fa-globe" style="color: blue;"></i> グローバルコンフィグ';
      window.ConfigEditor.loadConfig(window.Core.getGlobalConfig());
    } else {
      colorEditorTitle.innerHTML = 'カラー編集 ⇒ <i class="fa-solid fa-gear" style="color: orange;"></i> フレームコンフィグ';
      const cfg = window.Core.getFrameConfig(frameCfgIndex) ? window.Core.getFrameConfig(frameCfgIndex) : window.Core.getGlobalConfig();
      window.ConfigEditor.loadConfig(cfg);
    }
  }

  // プレビューキャンバス移動
  document.addEventListener('mousemove', e => {
    if (previewCanvas.style.display === 'none') return;
    // キャンバス幅／高さを読んで左にオフセット
    const cw = previewCanvas.width;
    const ch = previewCanvas.height;
    // マウスの左側に表示、上辺をカーソルの中央に合わせる
    previewCanvas.style.left = (e.pageX - cw - 10) + 'px';
    previewCanvas.style.top = (e.pageY - ch / 2) + 'px';
  });


  // マウスリリースイベント
  window.addEventListener('mouseup', () => {
    buttonIsPressed = false;
    cfgIsPressed = false;
  });

  // Keyboard shortcuts: frames
  document.addEventListener('keydown', (e) => {
    // Ignore when typing in inputs/textareas
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

    const key = e.key;
    const isAlt = e.altKey;

    // Frame decrement: '<' or ','  (support both '<' and ',' for different layouts)
    if ((key === '<' || key === ',') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (isAlt) {
        // Go to first frame
        if (frameBtns.length) {
          window.Core.setFrameIndex(0);
          accentFrmBtn(window.Core.getFrameIndex());
        }
      } else {
        // Decrement current frame
        if (frameBtns.length) {
          let nextIdx = Math.max(0, window.Core.getFrameIndex() - 1);
          window.Core.setFrameIndex(nextIdx);
          accentFrmBtn(nextIdx);
        }
      }
      return;
    }

    // Frame increment: '>' or '.'
    if ((key === '>' || key === '.') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (isAlt) {
        // Go to last frame
        if (frameBtns.length) {
          window.Core.setFrameIndex(frameBtns.length - 1);
          accentFrmBtn(window.Core.getFrameIndex());
        }
      } else {
        // Increment current frame
        if (frameBtns.length) {
          let nextIdx = Math.min(frameBtns.length - 1, window.Core.getFrameIndex() + 1);
          window.Core.setFrameIndex(nextIdx);
          accentFrmBtn(nextIdx);
        }
      }
      return;
    }
  });

  const updateFrameButtons = function () {
    let allProcessed = true;
    for (let j = 0; j < frameBtns.length; j++) {
      const btns = frameBtns[j];
      if (!btns) continue;
      const done = window.Core.checkLatest(j);
      if (!done) {
        allProcessed = false;
        btns.fbtn.style.backgroundColor = 'rgba(233, 84, 109, 1)';
      } else if (btns.cbtn.innerHTML) {
        btns.fbtn.style.backgroundColor = 'rgba(230, 129, 71, 1)';
      } else {
        btns.fbtn.style.backgroundColor = 'rgba(84, 106, 233, 1)';
      }
    }
  }

  menuContent.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  menuContent.addEventListener("mousedown", (event) => {
    if (event.button == 2) {
      cfgToggleStates.fill(false);
      updateCfgBtns();
    }
  });

  const getCfgToggleStates = function () { return cfgToggleStates; }

  const drawGear = async function (i) {
    frameBtns[i].cbtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
    frameBtns[i].cbtn.style.color = await hashToColor(window.Core.getFrameConfig(i).hash, 80, 65);
  }

  const clearGear = function () {
    for (let i = 0; i < frameBtns.length; ++i) {
      if (cfgToggleStates[i]) frameBtns[i].cbtn.innerHTML = '';
    }
    cfgToggleStates.fill(false);
    updateCfgBtns();
  }

  //// 共有オブジェクト
  window.FrameManager = {
    init,
    updateFrameButtons,
    getCfgToggleStates,
    drawGear,
    clearGear,
  }

})();
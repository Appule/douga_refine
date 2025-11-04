(function () {
  // hard-coded default config
  const currentVersion = 2.1;
  const DEFAULT_CONFIG = {
    "bgColor": "#e8eff2",
    "bgLabelColor": "#ffffff",
    "fileName": "デフォルト",
    "enableSharpness": true,
    "denoiseLevel": 3,
    "enableDebug": false,
    "version": currentVersion,
    "colorBlocks": [
      {
        "sliders": { "threshold": "60", "log": "20", "weight": "50" },
        "numbers": {},
        "color": "#7b7f7e",
        "labelColor": "#000000",
        "enabled": true
      },
      {
        "sliders": { "threshold": "60", "log": "40", "weight": "30" },
        "numbers": {},
        "color": "#d58b8d",
        "labelColor": "#ff0000",
        "enabled": true
      },
      {
        "sliders": { "threshold": "55", "log": "40", "weight": "40" },
        "numbers": {},
        "color": "#9bb76f",
        "labelColor": "#00ff00",
        "enabled": true
      },
      {
        "sliders": { "threshold": "56", "log": "40", "weight": "30" },
        "numbers": {},
        "color": "#94b6e3",
        "labelColor": "#0000ff",
        "enabled": true
      }
    ]
  }
  // initialize config entry for this block
  let cfgElm = { bgPicker: null, bgLabelPicker: null, colorBlocks: [] };
  // Html要素
  const importBtn = document.getElementById('importColorsBtn');
  const exportBtn = document.getElementById('exportColorsBtn');
  const fileInput = document.getElementById('configFileInput');
  const fileNameInput = document.getElementById('configFileNameInput');
  const clearFrameCfgBtn = document.getElementById('clearFrameCfgBtn');
  // 現在のコンフィグデータ
  let currentConfig = {};
  // Callback Function
  let clearConfigBtnCallBack
  function setClearConfigBtnCallBack(func) {
    clearConfigBtnCallBack = func;
  };

  // カラー編集ウィンドウの初期設定
  const init = function () {
    importBtn.addEventListener('click', () => { fileInput.click(); });
    /** file input アップロード時ファイルを処理 */
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) {
        loadConfigFile(fileInput.files[0]);
      }
    });
    fileNameInput.addEventListener('change', () => {
      currentConfig.fileName = fileNameInput.value;
      updateCurrentCfg();
    })
    /** ドラッグ&ドロップでファイル処理 */
    const cfgDropZone = document.getElementById('cfg-drop-zone');
    cfgDropZone.addEventListener('dragover', e => {
      e.preventDefault();
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
    // フレームコンフィグをクリア
    clearFrameCfgBtn.addEventListener('click', clearConfigBtnCallBack);

    createBgBlock();
    loadConfig(DEFAULT_CONFIG, true);
  }

  // エクスポートボタン
  exportBtn.addEventListener('click', saveConfig);

  // ConfigFileロード関数
  function loadConfigFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = JSON.parse(e.target.result);
      try {
        const fileName = file.name.split(".")[0];
        parsed.fileName = fileName;
        loadConfig(parsed, true);
        showStatus('Configファイルの読み込みが完了しました。', 'success', 3000);
      } catch (error) {
        console.error('Error loading config:', error);
        showStatus('Configファイルの読み込みに失敗しました。', 'error', 3000);
      }
    };
    reader.readAsText(file);
  }

  // コンフィグのセーブ (エクスポート)
  function saveConfig() {
    currentConfig.version = currentVersion;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${currentConfig.fileName}.json`);
    dlAnchorElem.click();
    showStatus('Configファイルの保存が完了しました。', 'success', 3000);
  }

  // 新しいカラーブロック要素を作成（削除ボタン付き）
  const createColorBlock = function (initialLabelColor = '#ff0000', initialColor = '#ff0000', initialSlider = { threshold: 0.5, log: 0, weight: 1 }) {
    const container = document.querySelector('.color-content');
    const colorBlockSize = container.querySelectorAll('.color-block').length;
    if (container.lastElementChild?.id === 'addColorBtn') {
      container.lastElementChild.remove();
    }

    const block = document.createElement('div');
    block.className = 'color-block';
    block.dataset.label = colorBlockSize;
    block.innerHTML = `
      <input type="checkbox" class="color-enable" title="有効/無効" checked />
      <button class="color-delete" title="削除">×</button>
      <div class="color-control-group">
        <div class="picker-stack">
          <div class="picker-dropper">
            <button class="color-toggle" title="スポイトツール" style="width: 36px; height: 36px;"><i class="fa-solid fa-eye-dropper"></i></button>
            <input type="color" class="color-picker main-picker small-picker" value="${initialColor}" />
          </div>
          <span class="picker-arrow">▼</span>
          <input type="color" class="color-picker label-picker" value="${initialLabelColor}" >
        </div>
        <div class="sliders-container">
          <div class="slider-row">
            <span class="slider-label">閾値　</span>
            <div class="slider-wrapper">
              <button class="arrow left" id="decrease">◀</button>
              <input type="range" class="color-slider" min="0" max="100" step="1" value="${initialSlider.threshold}" data-channel="threshold"/>
              <button class="arrow right" id="increase">▶</button>
            </div>
            <input type="number" class="slider-value" min="0" max="100" step="1" value="${initialSlider.threshold}"/>
          </div>
          <div class="slider-row">
            <span class="slider-label">線検知</span>
            <div class="slider-wrapper">
              <button class="arrow left" id="decrease">◀</button>
              <input type="range" class="color-slider" min="0" max="100" step="1" value="${initialSlider.log}" data-channel="log">
              <button class="arrow right" id="increase">▶</button>
            </div>
            <input type="number" class="slider-value" min="0" max="100" step="1" value="${initialSlider.log}"/>
          </div>
          <div class="slider-row">
            <span class="slider-label">重み　</span>
            <div class="slider-wrapper">
              <button class="arrow left" id="decrease">◀</button>
              <input type="range" class="color-slider" min="0" max="100" step="1" value="${initialSlider.weight}" data-channel="weight">
              <button class="arrow right" id="increase">▶</button>
            </div>
            <input type="number" class="slider-value" min="0" max="100" step="1" value="${initialSlider.weight}"/>
          </div>
        </div>
      </div>
    `;

    container.appendChild(block);

    // addColorBtn が必要なら再追加
    let addColorBtn = null;
    if (colorBlockSize < 6) {
      addColorBtn = document.createElement('button');
      addColorBtn.id = 'addColorBtn';
      addColorBtn.textContent = '＋';
      addColorBtn.style.width = '50px';
      container.appendChild(addColorBtn);
    }

    const checkbox = block.querySelector(".color-enable");
    const deleteBtn = block.querySelector(".color-delete");
    const mainPicker = block.querySelector(".main-picker");
    const labelPicker = block.querySelector(".label-picker");
    const sliders = block.querySelectorAll(".color-slider"); // [0]=threshold, [1]=log, [2]=weight
    const numbers = block.querySelectorAll(".slider-value"); // [0]=threshold, [1]=log, [2]=weight
    const buttons = block.querySelectorAll(".arrow"); // [0/1]=thresholdIn/Dc, [2/3]=logIn/Dc, [4/5]=weightIn/Dc
    const enableDropperBtn = block.querySelector(".color-toggle");

    enableDropperBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enableDropperBtn.classList.toggle('active');
    });

    cfgElm.colorBlocks.push({
      checkbox,
      colorPicker: mainPicker,
      labelPicker: labelPicker,
      sliders: {
        threshold: sliders[0],
        log: sliders[1],
        weight: sliders[2],
      },
      numbers: {
        threshold: numbers[0],
        log: numbers[1],
        weight: numbers[2],
      },
    });

    addColorBtn.addEventListener('click', () => {
      createColorBlock(); // create by default value
      updateCurrentCfg();
    });

    // カラーピッカーのイベント
    mainPicker.addEventListener('change', () => {
      console.log(`サンプルカラー更新: ${mainPicker.value}`);
      updateCurrentCfg();
    });
    labelPicker.addEventListener('change', () => {
      console.log(`ラベルカラー更新: ${labelPicker.value}`);
      updateCurrentCfg();
    });

    // スライダーと数値インプットを紐づけ
    sliders.forEach((slider, i) => {
      const number = numbers[i];
      const decreaseBtn = buttons[i * 2];
      const increaseBtn = buttons[i * 2 + 1];
      const step = Number(number.step) || 1;
      // range → number
      slider.addEventListener("change", () => {
        number.value = slider.value;
        console.log(`スライダー更新: ${slider.value}`);
        updateCurrentCfg();
      });
      // range → number
      slider.addEventListener("input", () => {
        number.value = slider.value;
      });
      // number → range
      number.addEventListener("change", () => {
        let val = Number(number.value);
        if (val < slider.min) val = slider.min;
        if (val > slider.max) val = slider.max;
        slider.value = val;
        number.value = val;
        console.log(`数値インプット更新: ${val}`);
        updateCurrentCfg();
      });
      // number → range
      number.addEventListener("input", () => {
        let val = Number(number.value);
        if (val < slider.min) val = slider.min;
        if (val > slider.max) val = slider.max;
        slider.value = val;
        number.value = val;
      });
      // number: ホイール操作
      number.addEventListener("wheel", (e) => {
        e.preventDefault(); // ページスクロールを止める
        let val = Number(number.value);
        if (e.deltaY < 0) val += step;
        else val -= step;
        if (val < slider.min) val = Number(slider.min);
        if (val > slider.max) val = Number(slider.max);
        number.value = val;
        slider.value = val;
        console.log(`数値インプット更新: ${val}`);
        updateCurrentCfg();
      });
      // button → range/number
      decreaseBtn.addEventListener("click", () => {
        slider.value = Math.max(Number(slider.min), Number(slider.value) - Number(slider.step));
        number.value = slider.value;
        console.log(`数値更新: ${slider.value}`);
        updateCurrentCfg();
      });
      increaseBtn.addEventListener("click", () => {
        slider.value = Math.max(Number(slider.min), Number(slider.value) + Number(slider.step));
        number.value = slider.value;
        console.log(`数値更新: ${slider.value}`);
        updateCurrentCfg();
      });
    });

    // 削除ボタンのイベント
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ok = window.confirm("本当にこの色を削除しますか？");
      if (ok) {
        const allColorBlocks = container.querySelectorAll('.color-block');
        allColorBlocks[colorBlockSize].remove();
        cfgElm.colorBlocks.splice(colorBlockSize, 1);
        const newCfg = updateCurrentCfg();
        allColorBlocks.forEach(e => e.remove());
        cfgElm.colorBlocks.length = 0;
        loadConfig(newCfg, true);
      }
    });

    // チェックボックスのイベント
    checkbox.addEventListener('change', () => {
      updateCurrentCfg();
    });

    // グローバル変数を更新
    updateCurrentCfg();
  }

  /* Create the background picker block and wire its listeners.
    The bg block provides both a color and a labelColor (styled like colorBlock pickers). */
  const createBgBlock = function (initialBgColor = '#ffffff', initialLabelColor = '#000000') {
    const container = document.querySelector('.color-content');

    // Remove any existing bg-block if present
    const existing = container.querySelector('.bg-block');
    if (existing) existing.remove();

    const html = `
      <div class="bg-block" style="background:#ffffff; display:flex; justify-content:center; align-items:center; height:80px; padding:20px; margin-right:4px;">
        <span style="margin-right:8px;">背景</span>
        <div class="picker-stack">
          <div class="picker-dropper">
            <button class="color-toggle" title="スポイトツール" style="width: 36px; height: 36px;"><i class="fa-solid fa-eye-dropper"></i></button>
            <input type="color" class="color-picker bg-color-picker small-picker" value="${initialBgColor}" data-label="bgColorPicker" />
          </div>
          <span class="picker-arrow">▼</span>
          <input type="color" class="color-picker bg-label-picker" value="${initialLabelColor}" />
        </div>
      </div>
    `;
    container.insertAdjacentHTML('afterbegin', html);

    // wire references and listeners
    cfgElm.bgPicker = container.querySelector('.bg-color-picker');
    cfgElm.bgLabelPicker = container.querySelector('.bg-label-picker');

    const enableDropperBtn = container.querySelector(".color-toggle");
    enableDropperBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enableDropperBtn.classList.toggle('active');
    });

    cfgElm.bgPicker.addEventListener('change', () => {
      console.log(`背景カラー更新: ${currentConfig.bgColor}`);
      updateCurrentCfg();
    });
    cfgElm.bgLabelPicker.addEventListener('change', () => {
      console.log(`背景ラベルカラー更新: ${currentConfig.bgLabelColor}`);
      updateCurrentCfg();
    });
  }

  // configを更新・描画
  const loadConfig = function (cfg, onlyShow = false) {
    currentConfig = cfg;
    if (onlyShow) applyConfig(cfg, window.FrameManager.getCfgToggleStates());
    updateCfgElm(cfg);
  }

  // cfgElmを更新
  const updateCfgElm = function (cfg) {
    cfgElm.bgPicker.value = cfg.bgColor;
    cfgElm.bgLabelPicker.value = cfg.bgLabelColor;

    fileNameInput.value = cfg.fileName;

    if (cfg.colorBlocks.length != cfgElm.colorBlocks.length) {
      cfg.colorBlocks.forEach((cb, i) => {
        createColorBlock(cb.labelColor, cb.color, { threshold: cb.sliders.threshold, log: cb.sliders.log, weight: cb.sliders.weight });
      });
    } else {
      cfg.colorBlocks.forEach((cb, i) => {
        cfgElm.colorBlocks[i].colorPicker.value = cb.color;
        cfgElm.colorBlocks[i].labelPicker.value = cb.labelColor;
        cfgElm.colorBlocks[i].sliders.threshold.value = cb.sliders.threshold;
        cfgElm.colorBlocks[i].sliders.log.value = cb.sliders.log;
        cfgElm.colorBlocks[i].sliders.weight.value = cb.sliders.weight;
        cfgElm.colorBlocks[i].numbers.threshold.value = cb.sliders.threshold;
        cfgElm.colorBlocks[i].numbers.log.value = cb.sliders.log;
        cfgElm.colorBlocks[i].numbers.weight.value = cb.sliders.weight;
        cfgElm.colorBlocks[i].checkbox.checked = cb.enabled;
      });
    }
  }

  // cfgElmでcurrentConfigを更新
  const updateCurrentCfg = function () {
    const cfg = {};
    cfg.bgColor = cfgElm.bgPicker.value;
    cfg.bgLabelColor = cfgElm.bgLabelPicker.value;

    cfg.fileName = fileNameInput.value;

    cfg.colorBlocks = Array(cfgElm.colorBlocks.length).fill(0).map((_) => { return { sliders: {}, numbers: {} } });
    cfgElm.colorBlocks.forEach((cb, i) => {
      cfg.colorBlocks[i].color = cb.colorPicker.value;
      cfg.colorBlocks[i].labelColor = cb.labelPicker.value;
      cfg.colorBlocks[i].sliders.threshold = cb.sliders.threshold.value;
      cfg.colorBlocks[i].sliders.log = cb.sliders.log.value;
      cfg.colorBlocks[i].sliders.weight = cb.sliders.weight.value;
      cfg.colorBlocks[i].enabled = cb.checkbox.checked;
    });

    const window0Stats = window.FloatPanel.getCfgStats();
    cfg.enableSharpness = window0Stats.enableSharpness;
    cfg.denoiseLevel = window0Stats.denoiseLevel;

    cfg.hash = culcCfgHash(cfg);

    currentConfig = cfg;
    applyConfig(currentConfig, window.FrameManager.getCfgToggleStates());

    return cfg;
  }

  const debugMode = function (stat = null) {
    if (stat === null) currentConfig.debugMode = !currentConfig.debugMode;
    else currentConfig.debugMode = stat;
    applyConfig(currentConfig, window.FrameManager.getCfgToggleStates());
  }

  let applyConfigCallback = () => { };
  const applyConfig = function (cfg, cfgToggleStates) {
    applyConfigCallback(cfg, cfgToggleStates);
  }
  const setApplyConfigCallback = function (func) {
    applyConfigCallback = func;
  }

  const culcCfgHash = function (cfg) {
    const copy = JSON.parse(JSON.stringify(cfg));
    delete copy.fileName;
    return JSON.stringify(copy);
  }

  const getColorBlockInfo = function (index) {
    if (currentConfig.colorBlocks && currentConfig.colorBlocks[index]) {
      const block = currentConfig.colorBlocks[index];
      return {
        labelColor: block.labelColor,
      };
    }
    return null;
  }

  const getColorBlockCount = function () {
    return cfgElm.colorBlocks.length;
  }

  const highlightColorBlock = function (index) {
    const container = document.querySelector('.color-content');
    const allBlocks = container.querySelectorAll('.color-block');
    allBlocks.forEach((block, i) => {
      if (i === index) {
        block.classList.add('highlighted');
      } else {
        block.classList.remove('highlighted');
      }
    });
  }

  const updateThresholdSlider = function (index, delta) {
    if (index < 0 || index >= cfgElm.colorBlocks.length) return;

    const block = cfgElm.colorBlocks[index];
    const slider = block.sliders.threshold;
    const number = block.numbers.threshold;

    let newValue = Number(slider.value) + delta;
    newValue = Math.max(Number(slider.min), Math.min(Number(slider.max), newValue));

    slider.value = newValue;
    number.value = newValue;
    updateCurrentCfg();
  }

  //// 共有オブジェクト
  window.ConfigEditor = {
    init,
    loadConfig,
    updateCurrentCfg,
    debugMode,
    setClearConfigBtnCallBack,
    setApplyConfigCallback,
    getColorBlockInfo,
    getColorBlockCount,
    highlightColorBlock,
    updateThresholdSlider,
  }

})();
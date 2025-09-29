(function() {

  // initialize config entry for this block
  const cfgElm = { bgPicker: null, bgLabelPicker: null, colorBlocks: [] };

  // カラー編集ウィンドウの初期設定
  const init = function() {
    // インポートボタン
    const importBtn = document.getElementById('importColorsBtn');
    const fileInput = document.getElementById('configFileInput');
    importBtn.addEventListener('click', () => { fileInput.click(); });
    /** file input アップロード時ファイルを処理 */
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) {
        loadConfigFile(fileInput.files[0]);
      }
    });
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

    createBgBlock();
    loadLocalConfig();
  }

  // エクスポートボタン
  document.getElementById('exportColorsBtn').addEventListener('click', saveConfig);

  // ローカルストレージからコンフィグをロード
  const loadLocalConfig = function() {
    const localConfig = localStorage.getItem("localConfigData");
    const parsed = JSON.parse(localConfig);
    if (localConfig) {
      try {
        updateConfig(parsed);
        updateCfgElm(parsed);
        showStatus('前回のConfigを復元しました。', 'success', 3000);
      } catch (error) {
        console.error('Error loading local config:', error);
        showStatus('前回のConfigの復元に失敗しました。', 'error', 3000);
      }
    }
  }

  // ConfigFileロード関数
  function loadConfigFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = JSON.parse(e.target.result);
      try {
        localStorage.setItem("localConfigData", JSON.stringify(parsed));
        updateConfig(parsed);
        updateCfgElm(parsed);
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
    localStorage.setItem("localConfigData", JSON.stringify(window.AppState.currentConfig));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.AppState.currentConfig, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `config_v2.json`);
    dlAnchorElem.click(); 
    showStatus('Configファイルの保存が完了しました。', 'success', 3000);
  }

  // 新しいカラーブロック要素を作成（削除ボタン付き）
  const createColorBlock = function(initialLabelColor = '#ff0000', initialColor = '#ff0000', initialSlider = { threshold: 0.5, log: 0, weight: 1 }) {
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
          <input type="color" class="color-picker main-picker" value="${initialColor}" />
          <span class="picker-arrow">▼</span>
          <input type="color" class="color-picker label-picker" value="${initialLabelColor}" >
        </div>
        <div class="sliders-container">
          <div class="slider-row">
            <span class="slider-label">閾値　</span>
            <input type="range" class="color-slider" min="0" max="100" step="1" value="${initialSlider.threshold}" data-channel="threshold"/>
            <input type="number" class="slider-value" min="0" max="100" step="1" value="${initialSlider.threshold}"/>
          </div>
          <div class="slider-row">
            <span class="slider-label">線検知</span>
            <input type="range" class="color-slider" min="0" max="100" step="1" value="${initialSlider.log}" data-channel="log">
            <input type="number" class="slider-value" min="0" max="100" step="1" value="${initialSlider.log}"/>
          </div>
          <div class="slider-row">
            <span class="slider-label">重み　</span>
            <input type="range" class="color-slider" min="0" max="100" step="1" value="${initialSlider.weight}" data-channel="weight">
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

    const checkbox    = block.querySelector(".color-enable");
    const deleteBtn   = block.querySelector(".color-delete");
    const mainPicker  = block.querySelector(".main-picker");
    const labelPicker = block.querySelector(".label-picker");
    const sliders     = block.querySelectorAll(".color-slider"); // [0]=threshold, [1]=log, [2]=weight
    const numbers     = block.querySelectorAll(".slider-value"); // [0]=threshold, [1]=log, [2]=weight

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
      colorBlocksUpdated(true);
    });

    // カラーピッカーのイベント
    mainPicker.addEventListener('input', () => {
      console.log(`サンプルカラー更新: ${mainPicker.value}`);
      colorBlocksUpdated(true);
    });
    labelPicker.addEventListener('input', () => {
      console.log(`ラベルカラー更新: ${labelPicker.value}`);
      colorBlocksUpdated(true);
    });
    
    // スライダーと数値インプットを紐づけ
    sliders.forEach((slider, i) => {
      const number = numbers[i];
      const step = Number(number.step) || 1;
      // range → number
      slider.addEventListener("input", () => {
        number.value = slider.value;
        console.log(`スライダー更新: ${slider.value}`);
        colorBlocksUpdated(true);
      });
      // number → range
      number.addEventListener("input", () => {
        let val = Number(number.value);
        if (val < slider.min) val = slider.min;
        if (val > slider.max) val = slider.max;
        slider.value = val;
        number.value = val;
        console.log(`数値インプット更新: ${val}`);
        colorBlocksUpdated(true);
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
        colorBlocksUpdated(true);
      });
    });

    // 削除ボタンのイベント
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ok = window.confirm("本当にこの色を削除しますか？");
      if (ok) {
        deleteColorBlock(colorBlockSize);
      }
    });
    
    // チェックボックスのイベント
    checkbox.addEventListener('change', () => {
      colorBlocksUpdated(true);
    });

    // グローバル変数を更新
    colorBlocksUpdated(true);
  }

  /* Create the background picker block and wire its listeners.
    The bg block provides both a color and a labelColor (styled like colorBlock pickers). */
  const createBgBlock = function(initialBgColor = '#ffffff', initialLabelColor = '#000000') {
    const container = document.querySelector('.color-content');

    // Remove any existing bg-block if present
    const existing = container.querySelector('.bg-block');
    if (existing) existing.remove();

    const html = `
      <div class="bg-block" style="background:#ffffff; display:flex; justify-content:center; align-items:center; height:80px; padding:20px; margin-right:4px;">
        <span style="margin-right:8px;">背景</span>
        <div class="picker-stack">
          <input type="color" class="color-picker bg-color-picker" value="${initialBgColor}" data-label="bgColorPicker" />
          <span class="picker-arrow">▼</span>
          <input type="color" class="color-picker bg-label-picker" value="${initialLabelColor}" />
        </div>
      </div>
    `;
    container.insertAdjacentHTML('afterbegin', html);

    // wire references and listeners
    cfgElm.bgPicker = container.querySelector('.bg-color-picker');
    cfgElm.bgLabelPicker = container.querySelector('.bg-label-picker');

    cfgElm.bgPicker.addEventListener('input', () => {
      console.log(`背景カラー更新: ${window.AppState.currentConfig.bgColor}`);
    });
    cfgElm.bgLabelPicker.addEventListener('input', () => {
      console.log(`背景ラベルカラー更新: ${window.AppState.currentConfig.bgLabelColor}`);
    });
  }

  // configを更新・描画
  const updateConfig = function(cfg, isEdited = false){
    window.AppState.currentConfig = cfg;
    if(isEdited) applyConfig(cfg);
    updateCfgElm(cfg);
  }

  // cfgElmを更新
  const updateCfgElm = function(cfg){
    cfgElm.bgPicker.value = cfg.bgColor;
    cfgElm.bgLabelPicker.value = cfg.bgLabelColor;

    if(cfg.colorBlocks.length != cfgElm.colorBlocks.length) {
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
  const colorBlocksUpdated = function(isEdited = false) {
    let cfg = {};
    cfg.bgColor = cfgElm.bgPicker.value;
    cfg.bgLabelColor = cfgElm.bgLabelPicker.value;

    cfg.colorBlocks = Array(cfgElm.colorBlocks.length).fill(0).map((_) => { return {sliders:{}, numbers:{}} });
    cfgElm.colorBlocks.forEach((cb, i) => {
      cfg.colorBlocks[i].color = cb.colorPicker.value;
      cfg.colorBlocks[i].labelColor = cb.labelPicker.value;
      cfg.colorBlocks[i].sliders.threshold = cb.sliders.threshold.value;
      cfg.colorBlocks[i].sliders.log = cb.sliders.log.value;
      cfg.colorBlocks[i].sliders.weight = cb.sliders.weight.value;
      cfg.colorBlocks[i].enabled = cb.checkbox.checked;
    });


    window.AppState.currentConfig = cfg;
    if(isEdited) applyConfig(cfg);
  }

  const applyConfig = function(cfg) {
    if(cfgToggleStates.some(Boolean)){
      for(let i = 0; i < cfgToggleStates.length; ++i){
        if(cfgToggleStates[i]) {
          window.AppState.frameConfigs[i] = cfg;
          frameBtns[i].cbtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
          if(processedImages['processed'][i]?.phase) --processedImages['processed'][i].phase;
        }
      }
    } else {
      window.AppState.globalConfig = cfg;
      ++window.AppState.updatePhase;
    }
    prepareAndShowImage(frameIndex, window.AppState.showMode);
  }

  //// 共有オブジェクト
  window.ConfigEditor = {
    init: init,
    updateConfig: updateConfig,
  }

})();
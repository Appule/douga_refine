(function() {

  // initialize config entry for this block
  const INITIAL_SLIDER_VAL = { threshold: 0.5, log: 0, weight: 1 };

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
  }

  // エクスポートボタン
  document.getElementById('exportColorsBtn').addEventListener('click', saveConfig);

  // ローカルストレージからコンフィグをロード
  const loadLocalConfig = function() {
    const localConfig = localStorage.getItem("localConfigData");
    const parsed = JSON.parse(localConfig);
    if (localConfig) {
      try {
        renderColorBlocksFromConfig(parsed);
        showStatus('前回のConfigを復元しました。', 'success', 3000);
      } catch (error) {
        console.error('Error loading local config:', error);
        showStatus('前回のConfigの復元に失敗しました。', 'error', 3000);
      }
    }
    // もし失敗したらデフォルト値に設定
    if (!window.AppState.currentConfig.colorBlocks || Object.keys(window.AppState.currentConfig.colorBlocks).length === 0) {
      createDefaultColorBlocks();
    }
  }

  // ConfigFileロード関数
  function loadConfigFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        // Reset and render color blocks from the loaded config (rebuild DOM & currentConfig)
        renderColorBlocksFromConfig(parsed);
        updateConfig();
        localStorage.setItem("localConfigData", JSON.stringify(globalConfig));
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
    localStorage.setItem("localConfigData", JSON.stringify(globalConfig));
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalConfig, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `config_v2.json`);
    dlAnchorElem.click(); 
    showStatus('Configファイルの保存が完了しました。', 'success', 3000);
  }

  // 新しいカラーブロック要素を作成（削除ボタン付き）
  const createColorBlock = function(initialLabelColor, initialColor, initialSlider) {
    let currentConfig = window.AppState.currentConfig;
    const colorBlockSize = currentConfig.colorBlocks ? Object.keys(currentConfig.colorBlocks).length : 0;
    const container = document.querySelector('.color-content');
    if (colorBlockSize != 0 && container.lastElementChild && container.lastElementChild.id == 'addColorBtn') container.lastElementChild.remove();

    // Keep block relatively positioned so delete button can be placed in top-right.
    let html = `
      <div class="color-block" data-label="${colorBlockSize}" style="position:relative;">
        <!-- Top-right: enable/disable checkbox -->
        <input type="checkbox" class="color-enable" title="有効/無効" style="position:absolute; right:4px; top:4px; width:20px; height:20px;" checked />
        <!-- Left-bottom: delete button (moved here) with red background -->
        <button class="color-delete" title="削除" style="position:absolute; right:6px; bottom:6px; width:20px; height:20px; line-height:16px; padding:0; border-radius:3px; background:red; color:white; border:none;">×</button>
        <div class="color-control-group">
          <div class="picker-stack">
            <input type="color" class="color-picker" value="${initialColor}" data-label="${colorBlockSize}" />
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
      </div>
      ${
        colorBlockSize < 7 ? `
          <button style="width: 50px;" id="addColorBtn" >
            ＋
          </button>
        ` : ``
      }
    `;

    container.insertAdjacentHTML('beforeend', html);
    
    // add button (if present) will be last element - ensure it creates a new color block
    const last = container.lastElementChild;
    if (last && last.id === 'addColorBtn') {
      last.addEventListener('click', () => {
        createColorBlock('#000000', '#000000', INITIAL_SLIDER_VAL);
      });
    }

    // add enabled flag default true so checkbox state is tracked
    window.AppState.currentConfig.colorBlocks[colorBlockSize] = { color: initialColor, labelColor: initialLabelColor, sliders: INITIAL_SLIDER_VAL, enabled: true };
    applyCurrentConfig();
    
    // bind events
    const block = container.querySelector(`.color-block[data-label="${colorBlockSize}"]`);
    setupSliderListeners(block, colorBlockSize);
    setupColorPickerListeners(block, colorBlockSize);

    // delete button (confirm before deletion)
    const delBtn = block.querySelector('.color-delete');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ok = window.confirm("本当にこの色を削除しますか？");
        if (ok) {
          deleteColorBlock(colorBlockSize);
        }
      });
    }
    
    // enable/disable checkbox listener
    const enableCheckbox = block.querySelector('.color-enable');
    if (enableCheckbox) {
      // initialize checked state from config (safeguard)
      enableCheckbox.checked = window.AppState.currentConfig.colorBlocks[colorBlockSize].enabled !== false;
      enableCheckbox.addEventListener('change', () => {
        window.AppState.currentConfig.colorBlocks[colorBlockSize].enabled = enableCheckbox.checked;
        applyCurrentConfig();
        ++window.AppState.updatePhase;
        prepareAndShowImage(frameIndex, window.AppState.showMode);
      });
    }
  }

  /* Create the background picker block and wire its listeners.
    The bg block provides both a color and a labelColor (styled like colorBlock pickers). */
  function createBgBlock(initialBgColor = '#ffffff', initialLabelColor = '#000000') {
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
          <input type="color" class="color-picker label-picker bg-label-picker" value="${initialLabelColor}" />
        </div>
      </div>
    `;
    container.insertAdjacentHTML('afterbegin', html);

    // wire references and listeners
    bgPicker = container.querySelector('.bg-color-picker');
    bgLabelPicker = container.querySelector('.bg-label-picker');

    let currentConfig = window.AppState.currentConfig;
    if (!currentConfig) currentConfig = { bgColor: initialBgColor, bgLabelColor: initialLabelColor, colorBlocks: {} };
    else {
      currentConfig.bgColor = initialBgColor;
      currentConfig.bgLabelColor = initialLabelColor;
    }
    window.AppState.currentConfig = currentConfig;

    if (bgPicker) {
      bgPicker.value = currentConfig.bgColor;
      bgPicker.addEventListener('input', () => {
        window.AppState.currentConfig.bgColor = bgPicker.value;
        console.log(`背景カラー更新: ${window.AppState.currentConfig.bgColor}`);
        applyCurrentConfig();
        ++window.AppState.updatePhase;
        prepareAndShowImage(frameIndex, window.AppState.showMode);
      });
    }
    if (bgLabelPicker) {
      bgLabelPicker.value = currentConfig.bgLabelColor || initialLabelColor;
      bgLabelPicker.addEventListener('input', () => {
        window.AppState.currentConfig.bgLabelColor = bgLabelPicker.value;
        console.log(`背景ラベルカラー更新: ${window.AppState.currentConfig.bgLabelColor}`);
        applyCurrentConfig();
        ++window.AppState.updatePhase;
        prepareAndShowImage(frameIndex, window.AppState.showMode);
      });
    }
  }

  /* Delete a color block by its numeric label index, then reindex and re-render */
  function deleteColorBlock(labelIndex) {
    const container = document.querySelector('.color-content');
    const toRemove = container.querySelector(`.color-block[data-label="${labelIndex}"]`);
    if (!toRemove) return;

    // Build new colorBlocks from remaining DOM blocks (preserve order)
    const remaining = Array.from(container.querySelectorAll('.color-block')).filter(b => b !== toRemove);
    const newBlocks = {};
    remaining.forEach((b, i) => {
      const color = b.querySelector('.color-picker')?.value || '#000000';
      const labelColor = b.querySelector('.label-picker')?.value || color;
      const sliders = {
        threshold: parseFloat(b.querySelector('.color-slider[data-channel="threshold"]')?.value) || INITIAL_SLIDER_VAL.threshold,
        log: parseFloat(b.querySelector('.color-slider[data-channel="log"]')?.value) || INITIAL_SLIDER_VAL.log,
        weight: parseFloat(b.querySelector('.color-slider[data-channel="weight"]')?.value) || INITIAL_SLIDER_VAL.weight,
      };
      newBlocks[i] = { color, labelColor, sliders };
    });

    // Replace currentConfig and re-render
    window.AppState.currentConfig.colorBlocks = newBlocks;
    renderColorBlocksFromConfig(window.AppState.currentConfig);
    applyCurrentConfig();
    ++window.AppState.updatePhase;
    prepareAndShowImage(frameIndex, window.AppState.showMode);
  }

  /* Update existing color blocks from a cfg (used when switching between global/frame modes) */
  const updateColorBlocks = function(cfg){ // カラーブロック値を更新
    const colorCfg = cfg ? cfg : globalConfig;
    if (!colorCfg) return;
    // If a frame config isn't provided, fall back to the globalConfig so sliders initialize from global values.
    const sliderCfg = cfg || globalConfig || null;
    let currentConfig = window.AppState.currentConfig;
    const keys = Object.keys(currentConfig.colorBlocks);
    currentConfig.bgColor = colorCfg.bgColor;
    currentConfig.bgLabelColor = colorCfg.bgLabelColor;
    for(let i = 0; i < keys.length; ++i){ // 黒,赤,緑,青,...
      const key = keys[i];
      const src = (colorCfg.colorBlocks && colorCfg.colorBlocks[key]) ? colorCfg.colorBlocks[key] : null;
      if (src) {
        currentConfig.colorBlocks[key].color = src.color;
        currentConfig.colorBlocks[key].labelColor = src.labelColor;
        currentConfig.colorBlocks[key].sliders = (sliderCfg && sliderCfg.colorBlocks && sliderCfg.colorBlocks[key]) ? { ...sliderCfg.colorBlocks[key].sliders } : { ...INITIAL_SLIDER_VAL };
      }
    }
    window.AppState.currentConfig = currentConfig;
    applyCurrentConfig();
  }

  // currentConfig に表示中の値を代入 bgColor, colorBlks{col, lcol, sliders{...}}
  const updateConfig = function(){
    let currentConfig = window.AppState.currentConfig;
    // update bg pickers if present
    if (currentConfig.bgColor) {
      if (bgPicker) bgPicker.value = currentConfig.bgColor;
    }
    if (currentConfig.bgLabelColor !== undefined) {
      if (bgLabelPicker) bgLabelPicker.value = currentConfig.bgLabelColor;
    }

    if (currentConfig.colorBlocks) {
      for (const [label, colorBlock] of Object.entries(currentConfig.colorBlocks)) {
        currentConfig.colorBlocks[label].color = colorBlock.color;
        const picker = document.querySelector(`.color-block[data-label="${label}"] .color-picker`);
        if (picker) picker.value = colorBlock.color;
        
        currentConfig.colorBlocks[label].labelColor = colorBlock.labelColor;
        const arrow = picker.nextElementSibling;
        const labelPicker = arrow ? arrow.nextElementSibling : null;
        if (labelPicker) labelPicker.value = colorBlock.labelColor;
        if (colorBlock.sliders) {
          for (const [param, value] of Object.entries(colorBlock.sliders)) { // param ... th, log, wei | value ... 0.5, 0, 1.0
            currentConfig.colorBlocks[label].sliders[param] = value;
            const slider = document.querySelector(`.color-block[data-label="${label}"] .color-slider[data-channel="${param}"]`);
            const number = slider?.parentElement.querySelector('.slider-value');
            // Slider range switching between global/frame removed.
            // Sliders use their stored absolute values; ranges remain the global ranges in UI.
            if (slider) slider.value = value;
            if (number) number.value = value;
          }
        }
        // Sync enabled checkbox state if present
        const enableCheckbox = document.querySelector(`.color-block[data-label="${label}"] .color-enable`);
        if (enableCheckbox) {
          // default to true unless explicitly false in cfg
          enableCheckbox.checked = (colorBlock.enabled === undefined) ? true : !!colorBlock.enabled;
          // ensure config has the enabled flag present
          currentConfig.colorBlocks[label].enabled = enableCheckbox.checked;
        }
      }
    }

    window.AppState.currentConfig = currentConfig;

    applyCurrentConfig();
    ++window.AppState.updatePhase;
    prepareAndShowImage(frameIndex, window.AppState.showMode);
  }

  //  デフォルトのカラーブロックを生成
  const createDefaultColorBlocks = function() {
    currentConfig.colorBlocks = {};
    const container = document.querySelector('.color-content');
    const bgInput = container.querySelector('input[data-label="bgColorPicker"]');
    const bgHtml = bgInput ? bgInput.closest('div').outerHTML : '';
    container.innerHTML = bgHtml;

    const defaults = [
      { labelColor:'#000000', color:'#000000' },
      { labelColor:'#ff0000', color:'#ff0000' },
      { labelColor:'#00ff00', color:'#00ff00' },
      { labelColor:'#0000ff', color:'#0000ff' },
    ];

    defaults.forEach(d => createColorBlock(d.labelColor, d.color, INITIAL_SLIDER_VAL));
    updateConfig();
  }

  // コンフィグ変数からカラーブロックを再描画
  const renderColorBlocksFromConfig = function(cfg) {
    if (!cfg) return;

    const container = document.querySelector('.color-content');
    container.innerHTML = ''; // clear everything; we'll create bg + blocks from JS

    // Create bg block (cfg may include bgLabelColor)
    const bgColor = cfg.bgColor || '#ffffff';
    const bgLabelColor = cfg.bgLabelColor || cfg.bgLabel || '#000000';
    createBgBlock(bgColor, bgLabelColor);

    // Recreate blocks in order
    window.AppState.currentConfig.colorBlocks = {};
    const entries = Object.entries(cfg.colorBlocks || {}).sort((a,b) => Number(a[0]) - Number(b[0]));
    entries.forEach(([k, v]) => {
      const labelColor = v.labelColor || v.color || '#000000';
      const color = v.color || '#000000';
      createColorBlock(labelColor, color, v.sliders);
      const idx = Object.keys(window.AppState.currentConfig.colorBlocks).length - 1;
      if (v.sliders) {
        window.AppState.currentConfig.colorBlocks[idx].sliders = { ...INITIAL_SLIDER_VAL, ...v.sliders };
      }
    });

    updateConfig();
  }

  // スライダーの処理
  const setupSliderListeners = function(container, label) {
    const sliderRows = container.querySelectorAll('.slider-row');
    sliderRows.forEach((row, i) => {
      const slider = row.querySelector('.color-slider');
      const number = row.querySelector('.slider-value');
      // スライダー変更による更新
      slider.addEventListener('input', () => {
        number.value = slider.value;
        updateSlider(label, slider.dataset.channel, slider.value);
      });
      // 数値インプット変更による更新
      number.addEventListener('input', () => {
        let v = parseFloat(number.value);
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);

        if (isNaN(v)) v = min;
        else v = Math.min(max, Math.max(min, v));

        slider.value = v;
        number.value = v;

        updateSlider(label, slider.dataset.channel, slider.value);
      });
      number.addEventListener('wheel', onWheelNum, {passive: false});
    });
  }

  const updateSlider = function(label, channel, value){
    const sliders = window.AppState.currentConfig.colorBlocks[label].sliders;
    sliders[channel] = parseFloat(value);
    console.log(`スライダー更新: ${label} ${channel} = ${sliders[channel]}`);
    applyCurrentConfig();
    ++window.AppState.updatePhase;
    prepareAndShowImage(frameIndex, window.AppState.showMode);
  }

  const onWheelNum = function(e) {
    e.preventDefault();

    const step = parseFloat(this.step) || 1;
    const min  = this.min !== '' ? parseFloat(this.min) : -Infinity;
    const max  = this.max !== '' ? parseFloat(this.max) :  Infinity;
    let   val  = parseFloat(this.value) || 0;

    val += e.deltaY < 0 ? step: -step;
    val = Math.min(max, Math.max(min, val));
    this.value = val.toFixed(getDecimalPlaces(step));

    this.dispatchEvent(new Event('input'));
  }

  const getDecimalPlaces = function(num) {
    const s = num.toString().split('.');
    return s[1] ? s[1].length : 0;
  }

  // カラーピッカーの処理
  const setupColorPickerListeners = function(container, label) {
    const picker = container.querySelector('.color-picker');
    picker.addEventListener('input', () => {
      window.AppState.currentConfig.colorBlocks[label].color = picker.value;
      console.log(`カラーピッカー更新: ${label} = ${window.AppState.currentConfig.colorBlocks[label].color}`);
      applyCurrentConfig();
    });
    const arrow = picker.nextElementSibling;
    const labelPicker = arrow.nextElementSibling;
    labelPicker.addEventListener('input', () => {
      window.AppState.currentConfig.colorBlocks[label].labelColor = labelPicker.value;
      console.log(`カラーピッカー更新: ${label} = ${window.AppState.currentConfig.colorBlocks[label].labelColor}`);
      applyCurrentConfig();
    });
  }

  // currentConfig を globalConfig/frameConfigs に適応
  const applyCurrentConfig = function() {
    const strCfg = JSON.parse(JSON.stringify(window.AppState.currentConfig));
    if(cfgToggleStates.some(Boolean)){
      for(let i = 0; i < cfgToggleStates.length; ++i){
        if(cfgToggleStates[i]) {
          frameConfigs[i] = strCfg;
          frameBtns[i].cbtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
          if(processedImages['processed'][i]?.phase) --processedImages['processed'][i].phase;
        }
      }
    } else {
      globalConfig = strCfg;
      ++window.AppState.updatePhase;
    }
    prepareAndShowImage(frameIndex, window.AppState.showMode);
  }

  //// 共有オブジェクト
  window.ConfigEditor = {
    init: init,
    loadLocalConfig: loadLocalConfig,
    updateColorBlocks: updateColorBlocks,
  }

})();
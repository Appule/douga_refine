(function() {
  // --- ParamsWindow Class ---
  class ParamsWindow {
    /**
     * @param {string} id - DOMのID
     * @param {string} backgroundColor - CSSの色指定 (例: 'rgba(255, 200, 200, 0.9)')
     */
    constructor(id, backgroundColor = 'rgba(255, 255, 255, 0.52)') {
      this.windowIsClicked = false;
      this.topZIndex = 100;
      
      this.el = document.getElementById(id);

      this.container = document.createElement('div');
      this.container.className = 'scroll-container';
      this.el.appendChild(this.container);
      this.el.style.backgroundColor = backgroundColor;

      this.el.addEventListener('mousedown', () => {
        this.topZIndex++;
        this.el.style.zIndex = this.topZIndex;
      });
      this.el.addEventListener('mouseleave', () => {
        this.windowIsClicked = false;
      });

      // Draggable
      interact(this.el).draggable({
        inertia: false,
        ignoreFrom: 'input, button, select, textarea',
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: true
          })
        ],
        listeners: {
          move(event) {
            const target = event.target;
            const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
            const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute('data-x', x);
            target.setAttribute('data-y', y);
          }
        }
      });

      // Resizable
      interact(this.el).resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        listeners: {
          move(event) {
            const target = event.target;

            let { width, height } = event.rect;
            target.style.width = `${width - 24}px`;
            target.style.height = `${height - 24}px`;
            let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.deltaRect.left;
            let y = (parseFloat(target.getAttribute('data-y')) || 0) + event.deltaRect.top;

            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute('data-x', x);
            target.setAttribute('data-y', y);
          }
        },
        modifiers: [
          interact.modifiers.restrictSize({
            min: { width: 150, height: 100 },
            max: { width: 600, height: 600 }
          })
        ],
        inertia: true
      });
    }

    show() {
      this.el.style.display = 'block';
    }
    hide() {
      this.el.style.display = 'none';
    }
    toggle(visible) {
      this.el.style.display = visible ? 'block' : 'none';
    }
    
    // Add Slider
    addSlider(label, min, max, value, step, onChange, sliderColor = '#009ddb') {
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '8px';

      const labelEl = document.createElement('label');
      labelEl.textContent = `${label}: `;
      wrapper.appendChild(labelEl);

      const valueEl = document.createElement('span');
      valueEl.textContent = value;
      wrapper.appendChild(valueEl);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = value;
      slider.style.width = '100%';
      slider.style.accentColor = sliderColor;
      slider.addEventListener('input', () => {
        valueEl.textContent = slider.value;
        if (typeof onChange === 'function') onChange(parseFloat(slider.value));
      });

      wrapper.appendChild(slider);
      this.container.appendChild(wrapper);

      return slider;
    }

    // Add Button
    addButton(label, onClick, draggable = false, color = 'rgb(92, 92, 92)') {
      const btn = document.createElement('button');
      btn.innerHTML = `${label}`;
      btn.style.display = 'block';
      btn.style.marginTop = '2px';
      btn.style.width = '100%';
      btn.style.backgroundColor = color;
      btn.style.border = "none";
      btn.style.padding = "6px";
      btn.style.fontSize = "14px";
      btn.style.color = 'white';

      if(!draggable) {
        btn.addEventListener('click', () => {
          if (typeof onClick === 'function') onClick();
        });
      }
      btn.addEventListener('mousedown', (event) => {
        this.windowIsClicked |= event.button == 0 ? 1 : 0;
        if(typeof onClick === 'function' && draggable) onClick();
        btn.classList.add('active');
      });
      btn.addEventListener('mouseup', (event) => {
        this.windowIsClicked &= event.button == 0 ? 0 : 1;
        btn.classList.remove('active');
      });
      btn.addEventListener("mouseenter", () => {
        if(typeof onClick === 'function' && draggable && this.windowIsClicked) {
          btn.classList.add('active');
          onClick();
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.classList.remove('active');
      });
      this.container.appendChild(btn);

      return btn;
    }

  
    // Add Toggle Button
    addToggle(label, initialState = false, onToggle, draggable = false, activeColor = 'rgb(0,153,221)', inactiveColor = 'rgb(92,92,92)') {
      const btn = document.createElement('button');
      btn.innerHTML = `${label}`;
      btn.style.display = 'block';
      btn.style.marginTop = '2px';
      btn.style.width = '100%';
      btn.style.border = "none";
      btn.style.padding = "6px";
      btn.style.fontSize = "14px";
      btn.style.color = 'white';
      btn.dataset.toggled = initialState ? '1' : '0';

      const applyBg = (toggled) => {
        btn.style.backgroundColor = toggled ? activeColor : inactiveColor;
        btn.setAttribute('aria-pressed', toggled ? 'true' : 'false');
      };
      applyBg(initialState);

      const toggle = () => {
        const was = btn.dataset.toggled === '1';
        const now = !was;
        btn.dataset.toggled = now ? '1' : '0';
        applyBg(now);
        if (typeof onToggle === 'function') onToggle(now);
      };

      if (!draggable) {
        btn.addEventListener('click', () => {
          toggle();
        });
      }

      // Mirror draggable behavior from addButton so toggles can be applied while dragging multiple targets
      btn.addEventListener('mousedown', (event) => {
        this.windowIsClicked |= event.button == 0 ? 1 : 0;
        if (typeof onToggle === 'function' && draggable) toggle();
        btn.classList.add('active');
      });
      btn.addEventListener('mouseup', (event) => {
        this.windowIsClicked &= event.button == 0 ? 0 : 1;
        btn.classList.remove('active');
      });
      btn.addEventListener('mouseenter', () => {
        if (typeof onToggle === 'function' && draggable && this.windowIsClicked) {
          btn.classList.add('active');
          toggle();
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.classList.remove('active');
      });

      this.container.appendChild(btn);
      return btn;
    }
    // Add Text Input
    addTextInput(label, onChange){
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '8px';

      const labelEl = document.createElement('label');
      labelEl.textContent = `${label}: `;
      wrapper.appendChild(labelEl);

      const input = document.createElement('input');

      input.style.width = '100%';
      input.style.boxSizing = 'border-box';
      input.style.marginTop = '4px';
      
      input.addEventListener('input', () => {
        onChange(input.value);
      });

      wrapper.appendChild(input);
      this.container.appendChild(wrapper);

      // save to inputs
      if (!this.inputs) this.inputs = {};
      this.inputs[label] = input;

      return input;
    }

    // Add Number Input
    addNumberInput(label, value, min, max, step, onChange){
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '8px';

      const labelEl = document.createElement('label');
      labelEl.textContent = `${label}: `;
      wrapper.appendChild(labelEl);

      const input = document.createElement('input');
      input.type = 'number';
      input.value = value;
      if (min !== undefined) input.min = min;
      if (max !== undefined) input.max = max;
      if (step !== undefined) input.step = step;

      input.style.width = '100%';
      input.style.boxSizing = 'border-box';
      input.style.marginTop = '4px';
      
      input.addEventListener('wheel', (e) => {
        e.preventDefault();
        let current = parseFloat(input.value) || 0;
        let s = parseFloat(input.step) || 1;

        let min = input.min !== '' ? parseFloat(input.min) : undefined;
        let max = input.max !== '' ? parseFloat(input.max) : undefined;

        if (e.deltaY < 0) current += s;
        else current -= s;

        if (min !== undefined) current = Math.max(current, min);
        if (max !== undefined) current = Math.min(current, max);

        input.value = current;
        if (typeof onChange === 'function') onChange(current);
      });

      input.addEventListener('input', () => {
        const num = parseFloat(input.value);
        if (!isNaN(num) && typeof onChange === 'function') {
          onChange(num);
        }
      });

      wrapper.appendChild(input);
      this.container.appendChild(wrapper);

      // save to inputs
      if (!this.inputs) this.inputs = {};
      this.inputs[label] = input;

      return input;
    }

    // Add Dropdown
    addDropdown(label, options = [], onChange, color = 'rgba(92, 92, 92, 1)') {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'block';
      wrapper.style.marginTop = '2px';
      wrapper.style.width = '100%';

      // ラベル
      const span = document.createElement('span');
      span.textContent = label;
      span.style.display = 'block';
      span.style.fontSize = '14px';
      span.style.marginBottom = '2px';
      wrapper.appendChild(span);

      // セレクトボックス
      const select = document.createElement('select');
      select.style.width = '100%';
      select.style.padding = '6px';
      select.style.border = 'none';
      select.style.backgroundColor = color;
      select.style.color = 'white';
      select.style.fontSize = '14px';
      select.style.cursor = 'pointer';

      // 選択肢を追加
      options.forEach(opt => {
        const option = document.createElement('option');
        if (typeof opt === 'string') {
          option.value = opt;
          option.textContent = opt;
        } else {
          // { value: 'val', text: '表示名' } 形式もサポート
          option.value = opt.value;
          option.textContent = opt.text;
        }
        select.appendChild(option);
      });

      // イベント
      select.addEventListener('change', () => {
        if (typeof onChange === 'function') onChange(select.value);
      });

      wrapper.appendChild(select);
      this.container.appendChild(wrapper);

      return select;
    }

    addFileInput(id) {
      const input = document.createElement('input');
      input.type = 'file';
      input.id = id;
      input.multiple = true;

      // ボタン風のスタイルを直接当てる
      input.style.display = "block";
      input.style.marginTop = "2px";
      input.style.width = '100%';
      input.style.fontSize = "14px";
      input.style.color = "black";

      // ブラウザ対応できる範囲で擬似ボタンを統一
      input.style.cssText += `
        &::file-selector-button {
          background: rgb(92, 92, 92);
          border: none;
          padding: 6px;
          font-size: 14px;
          color: black;
          cursor: pointer;
        }
        &::file-selector-button:hover {
          background: rgb(72, 72, 72);
        }
        &::file-selector-button:active {
          background: rgb(52, 52, 52);
        }
      `;

      this.container.appendChild(input);

      return input;
    }
  }

  const windows = [];
  let fileNameInput = null;
  let allProcBtn = null;
  let fileExtList = null;
  let saveDirBtn = null;

  // フロートウィンドウの初期設定
  const init = function() {
    windows.push(new ParamsWindow('param-global', 'rgba(224, 230, 255, 0.52)'));
    windows[0].el.style.height = '470px';

    windows[0].addButton('<i class="fa-solid fa-folder-open"></i> フォルダからアップ', () => window.CanvasEditor.uploadByDirHandle(), true, 'rgb(0, 185, 40)');

    // ファイル名入力欄
    fileNameInput = windows[0].addTextInput('保存ファイル名', () => {
      if (fileNameInput.value.trim() === '') {
        fileNameInput.classList.add('blink');
      } else {
        fileNameInput.classList.remove('blink');
      }
    });
    fileNameInput.classList.add('blink');

    // 表示切替ボタン
    windows[0].addButton('<i class="fa-solid fa-image"></i> 入力画像', () => window.Core.setShowMode('original'), true, 'rgb(0, 185, 40)');
    windows[0].addButton('<i class="fa-regular fa-image"></i> 出力画像', () => window.Core.setShowMode('processed'), true, 'rgb(0, 185, 40)');
    const sharpnessBtn = windows[0].addToggle('<i class="fa-solid fa-pencil"></i> シャープネス', true, () => window.ConfigEditor.updateCurrentCfg(), false, 'rgba(255, 104, 104, 1)', 'rgba(114, 114, 114, 1)');
    const denoiseList = windows[0].addDropdown('デノイズレベル', ['3','2','1','0'], () => window.ConfigEditor.updateCurrentCfg(), 'rgba(114, 114, 114, 1)');
    // windows[0].addButton('<i class="fa-solid fa-pencil"></i> 筆圧値', () => window.Core.setShowMode('pressure'), true);
    // windows[0].addButton('<i class="fa-solid fa-wave-square"></i> 線検知フィルタ', () => window.Core.setShowMode('log'), true);

    // その他
    const modeList = { 'デフォルト':'camera', '閾値上げ':'highTh', '閾値下げ':'lowTh' }; // カーソルモードと表示名の対応
    windows[0].addDropdown('カーソルモード', ['デフォルト', '閾値上げ', '閾値下げ'], (e) => { window.Core.setCursorMode(modeList[e]); }, 'rgba(89, 98, 219, 1)');
    allProcBtn = windows[0].addButton('<i class="fa-solid fa-images"></i> 全画像処理', () => window.Core.processAllImages(), false, 'rgb(0, 153, 221)');
    fileExtList = windows[0].addDropdown('保存形式', ['tga', 'png', 'tif'], () => {}, 'rgb(0, 185, 40)');
    saveDirBtn = windows[0].addButton('<i class="fa-solid fa-folder-open"></i> 保存先を選択', () => window.Core.setDirHandle(), false, 'rgb(0, 185, 40)');
    windows[0].addButton('<i class="fas fa-file-download"></i> すべて保存', () => window.Core.saveAllImages(), false, 'rgb(0, 153, 221)');

    // --- ウィンドウ表示切替 ---
    let visible = true;
    const toggleButton = document.getElementById('toggleButton');
    toggleButton.addEventListener('click', () => {
      visible = !visible;
      windows.forEach(w => w.toggle(visible));
      toggleButton.textContent = visible ? 'ウィンドウ非表示' : 'ウィンドウ表示';
    });
    windows.forEach(w => w.toggle(visible));
    // ウィンドウのトグルボタンは一旦非表示
    toggleButton.style.display = 'none';

    const blinkAllProcBtn = function(isBlink){
      if(isBlink) allProcBtn.classList.add('blink');
      else allProcBtn.classList.remove('blink');
    }
    const getFileName = function(){ return fileNameInput.value.trim(); }
    const getFileExt = function(){ return fileExtList.value; }

    const getCfgStats = function(){ return {enableSharpness:parseInt(sharpnessBtn.dataset.toggled), denoiseLevel:parseInt(denoiseList.value)}; }

    const setSaveDirName = function(name){ saveDirBtn.innerHTML = `<i class="fa-solid fa-folder-open"></i> 保存先 ⇒ ${name}`; }
  
    //// 共有オブジェクト
    window.FloatPanel = {
      updateFilenameInput,
      blinkAllProcBtn,
      getFileName,
      getFileExt,
      getCfgStats,
      setSaveDirName,
    }
    
    // Keyboard shortcuts: showMode toggle
    document.addEventListener('keydown', (e) => {
      // Ignore when typing in inputs/textareas
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      const key = e.key;

      // Toggle showMode: 'q' toggles between 'processed' and 'original'
      if (key.toLowerCase() === 'q' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        window.Core.setShowMode((window.Core.getShowMode() === 'processed') ? 'original' : 'processed');
        return;
      }
    });
  }

  const updateFilenameInput = function(fileName){
    fileNameInput.value = fileName;
    fileNameInput.dispatchEvent(new Event('input'));
  }

  init();

})();
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
      btn.style.width = '160px';
      btn.style.backgroundColor = color;
      btn.style.border = "none";
      btn.style.padding = "6px";
      btn.style.fontSize = "14px";
      btn.style.color = 'white';

      btn.addEventListener('click', () => {
        if (typeof onClick === 'function') onClick();
      });
      btn.addEventListener('mousedown', (event) => {
        this.windowIsClicked |= event.button == 0 ? 1 : 0;
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
      wrapper.style.width = '160px';

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
      input.style.width = "160px";
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

  // フロートウィンドウの初期設定
  const init = function() {
    windows.push(new ParamsWindow('param-global', 'rgba(224, 230, 255, 0.52)'));

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
    windows[0].addButton('<i class="fa-solid fa-image"></i> 入力画像', () => changeShowMode('original'), true, 'rgb(0, 185, 40)');
    windows[0].addButton('<i class="fa-regular fa-image"></i> 出力画像', () => changeShowMode('processed'), true, 'rgb(0, 185, 40)');
    windows[0].addButton('<i class="fa-solid fa-pencil"></i> 筆圧値', () => changeShowMode('pressure'), true);
    windows[0].addButton('<i class="fa-solid fa-wave-square"></i> 線検知フィルタ', () => changeShowMode('log'), true);

    // その他
    const modeList = { 'デフォルト':'camera', '閾値上げ':'highTh', '閾値下げ':'lowTh' }; // カーソルモードと表示名の対応
    windows[0].addDropdown('カーソルモード', ['デフォルト', '閾値上げ', '閾値下げ'], (e) => { window.AppState.cursorMode = modeList[e]; }, 'rgba(89, 98, 219, 1)');
    allProcBtn = windows[0].addButton('<i class="fa-solid fa-images"></i> 全画像処理', processAllImages, false, 'rgb(0, 153, 221)');
    fileExtList = windows[0].addDropdown('保存形式', ['', 'png', 'tif', 'tga'], () => {}, 'rgb(0, 185, 40)');
    windows[0].addButton('<i class="fas fa-file-download"></i> 保存', () => saveAllImages(processedImages.processed), false, 'rgb(0, 153, 221)');

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
  
    //// 共有オブジェクト
    window.FloatPanel = {
      windows: windows,
      updateFilenameInput: updateFilenameInput,
      allProcBtn: allProcBtn,
    }
  }

  const updateFilenameInput = function(fileName){
    fileNameInput.value = fileName;
    fileNameInput.dispatchEvent(new Event('input'));
  }

  const processAllImages = async function(){
    if(window.AppState.showMode === 'original') await changeShowMode('processed');
    for (let i = 0; i < uploadedImages.length; i++) {
      await prepareAndShowImage(i, window.AppState.showMode);
    }
    await prepareAndShowImage(frameIndex, window.AppState.showMode);
    showStatus('全画像の処理を実行しました。', 'success', 3000);
  }

  const saveAllImages = async function(images) {
    const fileName = fileNameInput.value.trim();
    const fileFormat = fileExtList.value;
    if (fileName === '') {
      alert('ファイル名を入力してください。');
      fileNameInput.classList.add('blink');
      return;
    }
    if (fileFormat === '') {
      alert('ファイル形式を選択してください。');
      return;
    }
    if (images.length === 0) {
      alert('保存する画像がありません。');
      return;
    }
    // 確認ダイアログ
    const ok = confirm(`「${fileName}_XXXX.${fileFormat}」という名前で保存しますか？`);
    if (!ok) {
      return; // キャンセルされたら処理を中止
    }
    // 全処理
    let allProcessed = false;
    for (let j = 0; j < uploadedImages.length; j++) {
      if (!images[j]?.img || window.AppState.updatePhase != images[j]?.phase) {
        allProcessed = false;
        break;
      }
      allProcessed = true;
    }
    if(!allProcessed){
      await processAllImages();
    }
    showStatus('ZIPファイルを生成中...', 'info');
    
    const zip = new JSZip();

    for (let i = 0; i < processedImages.processed.length; i++) {
      const imgData = processedImages.processed[i].img;
      if (!imgData) continue;

      canvas.width = imgData.width;
      canvas.height = imgData.height;
      ctx.putImageData(imgData, 0, 0);

      let blob;
      if (fileFormat === 'png') {
        blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      } else if (fileFormat === 'tif') {
        blob = encodeTIFF(imgData);
      } else if (fileFormat === 'tga') {
        blob = encodeTGA(imgData);
      } else {
        throw new Error('Unsupported format: ' + fileFormat);
      }
        
      const base = fileNameInput.value;
      const num  = fileInfos[i].padded;
      const name = `${base}_${num}.${fileFormat}`;

      zip.file(name, blob);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);

    showStatus('ZIPファイルの保存が完了しました。', 'success', 3000);
  }

  // Canvas ImageData → TIFF Blob
  const encodeTIFF = function(imgData) {
    // RGBA をそのまま Uint8Array で取得
    const rgba = new Uint8Array(imgData.data);

    // UTIF.encodeImage は RGBA配列・幅・高さを受け取る
    const tiffBuffer = UTIF.encodeImage(
      rgba,
      imgData.width,
      imgData.height,
      {
        t258: [8, 8, 8, 8], // BitsPerSample
        t259: [1],          // Compression
        t262: [2],          // PhotometricInterpretation
        t277: [4],          // SamplesPerPixel
      }
    );

    return new Blob([tiffBuffer], { type: "image/tiff" });
  }

  // Canvas ImageData → TGA Blob (RGB)
  const encodeTGA = function(imgData) {
    const w = imgData.width;
    const h = imgData.height;
    const pixels = imgData.data;
    const header = new Uint8Array(18);

    header[2] = 10;               // type10: RLE truecolor
    header[12] = w & 0xFF;
    header[13] = (w >> 8) & 0xFF;
    header[14] = h & 0xFF;
    header[15] = (h >> 8) & 0xFF;
    header[16] = 24;              // 24bit (BGR)
    header[17] = 0x00;            // origin 下左に変更

    const out = [];
    const getPixel = (x, y) => {
      const i = (y * w + x) * 4;
      return [pixels[i + 2], pixels[i + 1], pixels[i]]; // BGR
      // const bk = Math.max(Math.max(pixels[i + 2], pixels[i + 1]), pixels[i]);
      // return [bk, bk, bk]; // only blk
      // return bk == 0 ? [255, 255, 255] : [pixels[i + 2], pixels[i + 1], pixels[i]]; // only BGR
    };

    const pixelEquals = (x1, y1, x2, y2) => {
      const i1 = (y1 * w + x1) * 4;
      const i2 = (y2 * w + x2) * 4;
      return pixels[i1] === pixels[i2] && 
            pixels[i1 + 1] === pixels[i2 + 1] && 
            pixels[i1 + 2] === pixels[i2 + 2];
    };

    // 下から上に処理（TGA標準）
    for (let y = h - 1; y >= 0; y--) {
      let x = 0;
      while (x < w) {
        const startX = x;
        
        // 現在のピクセルから何個連続するかチェック
        let runLength = 1;
        while (x + runLength < w && 
              runLength < 128 && 
              pixelEquals(startX, y, startX + runLength, y)) {
          runLength++;
        }

        if (runLength >= 3) {
          // RLEパケット（3個以上連続する場合のみ）
          out.push(0x80 | (runLength - 1));
          const pixel = getPixel(startX, y);
          out.push(pixel[0], pixel[1], pixel[2]);
          x += runLength;
        } else {
          // RAWパケット
          let rawCount = 1;
          let nextX = x + 1;
          
          // 次に3個以上連続する箇所が出てくるまで、またはパケット上限まで
          while (nextX < w && rawCount < 128) {
            // 現在位置から3個連続チェック
            let consecutiveCount = 1;
            while (nextX + consecutiveCount < w && 
                  consecutiveCount < 3 && 
                  pixelEquals(nextX, y, nextX + consecutiveCount, y)) {
              consecutiveCount++;
            }
            
            // 3個以上連続するなら、RAWパケットを終了
            if (consecutiveCount >= 3) {
              break;
            }
            
            rawCount++;
            nextX++;
          }

          // RAWパケット出力
          out.push(rawCount - 1);
          for (let i = 0; i < rawCount; i++) {
            const pixel = getPixel(x + i, y);
            out.push(pixel[0], pixel[1], pixel[2]);
          }
          x += rawCount;
        }
      }
    }

    const body = new Uint8Array(out);
    return new Blob([header, body], { type: "image/x-tga" });
  }

  // --- float panel ---
  const changeShowMode = function(mode) {
    window.AppState.showMode = mode;
    prepareAndShowImage(frameIndex, window.AppState.showMode);
  }

  init();

})();
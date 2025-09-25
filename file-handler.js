async function loadTIFF(file) {
  // Return ImageData for a TIFF file (caller will handle canvas drawing / caching)
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  UTIF.decodeImages(buffer, ifds);

  const rgba = UTIF.toRGBA8(ifds[0]);
  const width = ifds[0].width;
  const height = ifds[0].height;

  return new ImageData(new Uint8ClampedArray(rgba), width, height);
}

async function loadTGA(file) {
  // Parse TGA and return ImageData (caller will handle canvas drawing / caching)
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  // --- ヘッダ解析 ---
  const idLength   = view.getUint8(0);
  const colorMap   = view.getUint8(1);
  const imageType  = view.getUint8(2);   // 2 = 非圧縮RGB, 10 = RLE圧縮RGB
  const width      = view.getUint16(12, true);
  const height     = view.getUint16(14, true);
  const depth      = view.getUint8(16);  // 24 or 32
  const descriptor = view.getUint8(17);

  if (imageType !== 2 && imageType !== 10) {
    throw new Error("Unsupported TGA type (only type2 or type10 supported).");
  }

  const offset = 18 + idLength; // IDフィールドを飛ばす
  const bytesPerPixel = depth / 8;
  const imageData = new ImageData(width, height);
  const rgba = imageData.data;
  const flipY = !(descriptor & 0x20);

  let src = offset;
  let dst = 0;

  function writePixel(r, g, b, a) {
    const px = dst / 4;
    const x = px % width;
    const y = Math.floor(px / width);
    const row = flipY ? (height - 1 - y) : y;
    const dstIndex = (row * width + x) * 4;
    rgba[dstIndex] = r;
    rgba[dstIndex + 1] = g;
    rgba[dstIndex + 2] = b;
    rgba[dstIndex + 3] = a;
    dst += 4;
  }

  if (imageType === 2) {
    // 非圧縮
    while (dst < width * height * 4) {
      const b = view.getUint8(src++);
      const g = view.getUint8(src++);
      const r = view.getUint8(src++);
      const a = (bytesPerPixel === 4) ? view.getUint8(src++) : 255;
      writePixel(r, g, b, a);
    }
  } else if (imageType === 10) {
    // RLE圧縮
    while (dst < width * height * 4) {
      const header = view.getUint8(src++);
      const count = (header & 0x7F) + 1;

      if (header & 0x80) {
        // RLEパケット
        const b = view.getUint8(src++);
        const g = view.getUint8(src++);
        const r = view.getUint8(src++);
        const a = (bytesPerPixel === 4) ? view.getUint8(src++) : 255;
        for (let i = 0; i < count; i++) {
          writePixel(r, g, b, a);
        }
      } else {
        // RAWパケット
        for (let i = 0; i < count; i++) {
          const b = view.getUint8(src++);
          const g = view.getUint8(src++);
          const r = view.getUint8(src++);
          const a = (bytesPerPixel === 4) ? view.getUint8(src++) : 255;
          writePixel(r, g, b, a);
        }
      }
    }
  }

  return imageData;
}

async function loadIMG(file) {
  // Read as DataURL, draw into an offscreen canvas and return ImageData
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        // Ensure offscreen canvas is available and sized
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
        osctx.clearRect(0, 0, width, height);
        osctx.drawImage(img, 0, 0, width, height);
        try {
          const imageData = osctx.getImageData(0, 0, width, height);
          resolve(imageData);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Canvas ImageData → TIFF Blob
function encodeTIFF(imgData) {
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
function encodeTGA(imgData) {
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

async function saveImages() {
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
  if (processedImages.processed.length === 0) {
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
    if (!processedImages['processed'][j]?.img || updatePhase != processedImages['processed'][j]?.phase) {
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
  
  localStorage.setItem("localConfigData", JSON.stringify(globalConfig));
  zip.file("config.json", JSON.stringify(globalConfig, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${fileName}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);

  showStatus('ZIPファイルの保存が完了しました。', 'success', 3000);
}

// ローカルストレージからコンフィグをロード
function loadLocalConfig() {
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
}

// コンフィグのセーブ (エクスポート)
const exportBtn = document.getElementById('exportColorsBtn');
function saveConfig() {
  localStorage.setItem("localConfigData", JSON.stringify(globalConfig));
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalConfig, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `config_v2.json`);
  dlAnchorElem.click(); 
  showStatus('Configファイルの保存が完了しました。', 'success', 3000);
}
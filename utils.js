function showStatus(message, type = 'info', duration = null) {
  const statusElement = document.getElementById('status')
  statusElement.innerHTML = `<div class="${type}">${message}</div>`;

  if (duration > 0) {
    setTimeout(() => {
      statusElement.innerHTML = '';
    }, duration);
  }
}

function hexToInt32(hex) {
  // 先頭の#を除去
  let h = hex.replace(/^#/, '');
  let r, g, b, a = 0x00;

  if (h.length === 3) {
    // '#RGB' → 'R','G','B' を複製
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else if (h.length === 6 || h.length === 8) {
    // '#RRGGBB' or '#RRGGBBAA'
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
    if (h.length === 8) {
      a = parseInt(h.slice(6, 8), 16);
    }
  } else {
    throw new Error('Invalid HEX color: ' + hex);
  }
  // ビットシフトで 0xAABBGGRR
  return ((r & 0xFF))  | 
         ((g & 0xFF) << 8)  | 
         ((b & 0xFF) << 16) | 
         ((a & 0xFF) << 24);
}

function hexToHue(colInt32) {
  // 0xRRGGBBAA から R,G,B を取り出し [0,1] に正規化
  const r = ((colInt32 >> 0 ) & 0xff) / 255;
  const g = ((colInt32 >> 8 ) & 0xff) / 255;
  const b = ((colInt32 >> 16) & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if      (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else                h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return h;
}

// Canvas ImageData → PNG Blob
const encodePNG = function(imgData) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = imgData.width;
    canvas.height = imgData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imgData, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Blobの生成に失敗しました'));
      }
    }, 'image/png');
  });
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
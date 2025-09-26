(function() {
  // ファイル操作
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

  window.ImageLoader = {
    loadTIFF: loadTIFF,
    loadTGA: loadTGA,
    loadIMG: loadIMG,
  }

})();
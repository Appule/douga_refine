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
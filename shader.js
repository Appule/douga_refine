// --- WebGPUコンピュートシェーダーコード ---
let uniformsCode = '';

function makeUniformsCodes(){
  uniformsCode = `
    struct ColorUniform {
      col: f32,
      labelCol: f32,
      threshold: f32,
      logFac: f32,
      weight: f32,
      pad0: f32,
      pad1: f32,
      pad2: f32,
    };

    struct Uniforms {
      width: u32,
      height: u32,
      colorNum: u32,
      whiteCol: u32,
      params: array<ColorUniform, 8>,
    }
  `;
}

const tracePressShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<u32>;
  @group(0) @binding(2) var<storage, read> imageIn2: array<u32>;
  @group(0) @binding(3) var<storage, read_write> imageOutP: array<f32>;
  @group(0) @binding(4) var<storage, read_write> imageOutC: array<u32>;
  // @group(0) @binding(4) var<storage, read_write> imageOutD: array<u32>;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let bgPos = int2xyz(uniforms.whiteCol);
    var samplePallet: array<vec3f, 8>;
    var weights: array<f32, 8>;
    for (var i: u32 = 0u; i < 8u; i = i + 1u) {
      samplePallet[i] = int2xyz(u32(uniforms.params[i].col));
      weights[i] = uniforms.params[i].weight;
    }
    
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) { return; }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let h = i32(height);
    let index = y * w + x;

    let pixelIn = imageIn[u32(index)];
    let xyz = int2xyz(pixelIn);

    let idx = decideIndexByFacesAndWeights(bgPos, samplePallet, u32(uniforms.colorNum), weights, xyz);

    // 白か色かの判定
    let res = classifyWithThreshold(
      bgPos, samplePallet, xyz, idx,
      uniforms.params[u32(idx)].threshold
    );

    // 出力値の決定
    // col = 0xCCIIPPFF: C: color index, I: intensity (0-255) (0 is white), P: padding, F: always 255
    let col = u32(idx) | (select(0xFFu, 0x00u, res.isWhite) << 8u) | (0x00u << 16u) | (0xFFu << 24u);
    var pres = res.pressure;

    let pixelIn2 = imageIn2[u32(index)];
    let r2 = f32((pixelIn2 >> 0u) & 0xFFu) / 255.;
    let b2 = f32((pixelIn2 >> 16u) & 0xFFu) / 255.;
    pres = min(pres * (1.0 + (r2 - b2) * 1.0), 1.0);

    // 出力 pressure, color
    imageOutP[u32(index)] = 1.0 - pres;
    imageOutC[u32(index)] = col;
    // imageOutD[u32(index)] = u32((xyz.x / 2.0 + 0.5) * 255.0) | (u32((xyz.y / 2.0) * 255.0) << 8u) | (u32((xyz.z / 2.0 + 0.5) * 255.0) << 16u) | (0xFFu << 24u);
  }
  
  const EPS: f32 = 1e-6;

  struct Hit {
    hit: bool,
    t: f32,
    q: vec3f,   // 交点
  }

  // 直線 ro + t * rd と、点 p0,p1,p2 が張る「平面」との交点
  fn intersectRayPlane(ro: vec3f, rd: vec3f, p0: vec3f, p1: vec3f, p2: vec3f) -> Hit {
    let n = normalize(cross(p1 - p0, p2 - p0));
    let denom = dot(rd, n);
    // 平行 or ほぼ平行
    if (abs(denom) < EPS) {
      return Hit(false, 0.0, vec3f(0.0));
    }
    let t = dot(p0 - ro, n) / denom;
    // 直線の「進行方向の先」にない（t < 0）は無効
    if (t < 0.0) {
      return Hit(false, t, vec3f(0.0));
    }
    let q = ro + t * rd;
    return Hit(true, t, q);
  }

  // 3つの面 (0,1,2), (0,2,3), (0,1,3) と白→p の直線との交点のうち、最も近いものを返す
  fn closestIntersectionOnFaces(white: vec3f, samplePallet: array<vec3f, 8>, colorNum: u32, p: vec3f) -> Hit {
    let rd = p - white;

    var best = Hit(false, 1e30, vec3f(0.0));

    for(var i: u32 = 1u; i < colorNum; i++){
      let h = intersectRayPlane(white, rd, samplePallet[0], samplePallet[i], samplePallet[i % (colorNum-1) + 1]);
      if (h.hit && h.t < best.t) { best = h; }
    }

    return best;
  }

  // 交点 q が得られたら、点(0..3) それぞれへの距離に weights を掛けたスコアで最も近い色を選ぶ
  // スコア: score_i = weights[i] / max(distance(q, sample[i]), EPS)
  fn pickIndexByWeightedNearest(samplePallet: array<vec3f, 8>, weights: array<f32, 8>, colorNum: u32, q: vec3f) -> i32 {
    var bestIdx: i32 = 0;
    var bestScore: f32 = -1.0;

    for (var i: u32 = 0u; i < colorNum; i++) {
      let d = length(q - samplePallet[i]);
      let w = max(weights[i], EPS);
      let score = w / max(d, EPS);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i32(i);
      }
    }
    return bestIdx;
  }

  // メインの判定関数：
  // 1) 白→p の直線と 3面の交点のうち最も近いものを取得
  // 2) 交点が見つかれば weights を加味して 0..3 のどれに属するか決定
  // 3) 交点が見つからなければフォールバック（p に最も近い色を weights 付きで選択）
  fn decideIndexByFacesAndWeights(
    white: vec3f,
    samplePallet: array<vec3f, 8>,
    colorNum: u32,
    weights: array<f32, 8>,
    p: vec3f
  ) -> i32 {
    let h = closestIntersectionOnFaces(white, samplePallet, colorNum, p);
    if (h.hit) {
      return pickIndexByWeightedNearest(samplePallet, weights, colorNum, h.q);
    } else {
      // フォールバック：交点が得られないときは p 自体で重み付き最近傍
      return pickIndexByWeightedNearest(samplePallet, weights, colorNum, p);
    }
  }

  struct ClassifyResult {
    isWhite: bool,
    colorIdx: i32,
    pressure: f32,
  }

  fn classifyWithThreshold(
    bgPos: vec3f,
    samplePallet: array<vec3f, 8>,
    xyz: vec3f,
    idx: i32,
    threshold: f32
  ) -> ClassifyResult {
    let colPos = samplePallet[u32(idx)];

    // 線分 bgPos → colPos の方向
    let dir = colPos - bgPos;
    let len2 = dot(dir, dir);

    // xyz を bgPos を基準に射影して [0,1] の範囲に正規化
    var t = dot(xyz - bgPos, dir) / len2;
    t = clamp(t, 0.0, 1.0);

    // t が閾値未満なら白、それ以外は色
    if (t < threshold) {
      return ClassifyResult(true, -1, t); // 白
    } else {
      return ClassifyResult(false, idx, t); // 色
    }
  }

  fn rgb2hsl(rgb: vec3f) -> vec3f {
    let r = rgb.x;
    let g = rgb.y;
    let b = rgb.z;

    let maxc = max(r, max(g, b));
    let minc = min(r, min(g, b));
    let delta = maxc - minc;

    var H: f32 = 0.0;
    var S: f32 = 0.0;
    let L: f32 = 0.5 * (maxc + minc);

    if (delta != 0.0) {
      if (maxc == r) {
        H = (g - b) / delta + (select(0.0, 6.0, g < b));
      } else if (maxc == g) {
        H = (b - r) / delta + 2.0;
      } else { // maxc == b
        H = (r - g) / delta + 4.0;
      }
      H = H / 6.0; // 0〜1に正規化

      S = delta / (1.0 - abs(2.0 * L - 1.0));
    }

    return vec3f(H, S, L);
  }

  fn hsl2xyz(hsl: vec3f) -> vec3f {
    let h = hsl.x * 2.0 * 3.14159265;
    let s = hsl.y;
    let l = hsl.z;

    let absVal = abs(2.0 * l - 1.0);
    let x = (1.0 - absVal) * s * cos(h);
    let z = (1.0 - absVal) * s * sin(h);
    let y = l * 2.0;

    return vec3f(x, y, z);
  }

  fn int2xyz(i: u32) -> vec3f {
    var r = f32((i >> 0u) & 0xFFu) / 255.;
    var g = f32((i >> 8u) & 0xFFu) / 255.;
    var b = f32((i >> 16u) & 0xFFu) / 255.;

    return hsl2xyz(rgb2hsl(vec3f(r, g, b)));
  }
`;

const sharpnessShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<f32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<f32>;

  const sp = 0.1;
  const gaussKernel: array<array<f32, 3>, 3> = array(
    array<f32, 3>(-sp, -sp, -sp),
    array<f32, 3>(-sp, 1.0 + 8*sp, -sp),
    array<f32, 3>(-sp, -sp, -sp)
  );
  const ksz = 1;

  // const gaussKernel: array<array<f32, 5>, 5> = array(
  //   array<f32, 5>(1.0, 4.0, 6.0, 4.0, 1.0),
  //   array<f32, 5>(4.0, 16.0, 24.0, 16.0, 4.0),
  //   array<f32, 5>(6.0, 24.0, 36.0, 24.0, 6.0),
  //   array<f32, 5>(4.0, 16.0, 24.0, 16.0, 4.0),
  //   array<f32, 5>(1.0, 4.0, 6.0, 4.0, 1.0)
  // );
  // const ksz = 2;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) { return; }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let h = i32(height);
    let index = y * w + x;

    var sum: f32 = 0.0;
    var weightSum: f32 = 0.0;

    for (var dy = -ksz; dy <= ksz; dy++) {
      for (var dx = -ksz; dx <= ksz; dx++) {
        let sx = clamp(x + dx, 0, w - 1);
        let sy = clamp(y + dy, 0, h - 1);
        let sampleIndex = sy * w + sx;

        let value = imageIn[u32(sampleIndex)];
        let weight = gaussKernel[(dy + ksz)][(dx + ksz)];

        sum += value * weight;
        weightSum += weight;
      }
    }

    let blurred = clamp(sum / weightSum + 0.1, 0.0, 1.0);
    imageOut[u32(index)] = blurred;
  }
`;

const gaussianShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<f32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<f32>;

  const gaussKernel: array<array<f32, 3>, 3> = array(
    array<f32, 3>(1.0, 2.0, 1.0),
    array<f32, 3>(2.0, 4.0, 2.0),
    array<f32, 3>(1.0, 2.0, 1.0)
  );
  const ksz = 1;

  // const gaussKernel: array<array<f32, 5>, 5> = array(
  //   array<f32, 5>(1.0, 4.0, 6.0, 4.0, 1.0),
  //   array<f32, 5>(4.0, 16.0, 24.0, 16.0, 4.0),
  //   array<f32, 5>(6.0, 24.0, 36.0, 24.0, 6.0),
  //   array<f32, 5>(4.0, 16.0, 24.0, 16.0, 4.0),
  //   array<f32, 5>(1.0, 4.0, 6.0, 4.0, 1.0)
  // );
  // const ksz = 2;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) { return; }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let h = i32(height);
    let index = y * w + x;

    var sum: f32 = 0.0;
    var weightSum: f32 = 0.0;

    for (var dy = -ksz; dy <= ksz; dy++) {
      for (var dx = -ksz; dx <= ksz; dx++) {
        let sx = clamp(x + dx, 0, w - 1);
        let sy = clamp(y + dy, 0, h - 1);
        let sampleIndex = sy * w + sx;

        let value = imageIn[u32(sampleIndex)];
        let weight = gaussKernel[(dy + ksz)][(dx + ksz)];

        sum += value * weight;
        weightSum += weight;
      }
    }

    let blurred = clamp(sum / weightSum, 0.0, 1.0);
    imageOut[u32(index)] = blurred;
  }
`;

const gaussianMultColShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<u32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<u32>;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) { return; }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let h = i32(height);
    let index = y * w + x;

    let colId = (imageIn[u32(index)] >> 0u ) & 0xFFu; // 下位8ビットに色IDが入っている
    var sum: f32 = 0.0;
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        let sx = clamp(x + dx, 0, w - 1);
        let sy = clamp(y + dy, 0, h - 1);
        let sampleIndex = sy * w + sx;
        let pixel = imageIn[u32(sampleIndex)];

        let colId2 = (pixel >> 0u ) & 0xFFu; // 下位8ビットに色IDが入っている
        let value = f32((pixel >> 8u) & 0xFFu); // 上位8ビットに色値が入っている

        sum += select(-value * 1, value, colId == colId2);
      }
    }

    sum = clamp(sum / 25.0, 0.0, 255.0);
    let res = u32(colId) | (u32(sum) << 8u) | (0x00u << 16u) | (0xFFu << 24u); // col = 0xCCIIPPFF
    imageOut[u32(index)] = res;
  }
`;

const laplacianShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<f32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<f32>;

  // 3x3 ラプラシアンフィルタ
  const lapKernel: array<array<f32, 3>, 3> = array(
    array<f32, 3>(0.0, 1.0, 0.0),
    array<f32, 3>(1.0, -4.0, 1.0),
    array<f32, 3>(0.0, 1.0, 0.0)
  );
  const ksz = 1;

  // 5x5 ラプラシアンフィルタ
  // const lapKernel: array<array<f32, 5>, 5> = array(
  //   array<f32, 5>(0.0, 0.0, 1.0, 0.0, 0.0),
  //   array<f32, 5>(0.0, 1.0, 2.0, 1.0, 0.0),
  //   array<f32, 5>(1.0, 2.0,-16.0, 2.0, 1.0),
  //   array<f32, 5>(0.0, 1.0, 2.0, 1.0, 0.0),
  //   array<f32, 5>(0.0, 0.0, 1.0, 0.0, 0.0),
  // );
  // const ksz = 2;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) { return; }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let h = i32(height);
    let index = y * w + x;

    var sum: f32 = 0.0;
    for (var dy = -ksz; dy <= ksz; dy++) {
      for (var dx = -ksz; dx <= ksz; dx++) {
        let sx = clamp(x + dx, 0, w - 1);
        let sy = clamp(y + dy, 0, h - 1);
        let sampleIndex = sy * w + sx;

        let value = imageIn[u32(sampleIndex)];
        let weight = lapKernel[(dy + ksz)][(dx + ksz)];

        // sum += 10.0 * min(min(value + 0.1, 1.0) * 0.1, 0.1) * weight;
        sum += min(value + 0.05, 1.0) * weight;
      }
    }

    var edge = 1.0 - clamp(20 * sum, 0.0, 1.0);
    imageOut[u32(index)] = edge;
  }
`;

const affineBinaryShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<f32>;
  @group(0) @binding(2) var<storage, read> imageIn2: array<f32>;
  @group(0) @binding(3) var<storage, read> imageIn3: array<u32>;
  @group(0) @binding(4) var<storage, read_write> imageOut: array<u32>;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) {
      return;
    }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let index = y * w + x;

    let pres = imageIn[u32(index)];
    let lap = imageIn2[u32(index)];

    let pixelGau = imageIn3[u32(index)];
    let colId = (pixelGau >> 0u ) & 0xFFu; // 色ID
    let gau = f32((pixelGau >> 8u) & 0xFFu); // 色値

    // 閾値処理
    let gauFactor = 0.0008 * uniforms.params[colId].logFac * gau;
    let lapFactor = 0.1 * uniforms.params[colId].logFac * (1.0 - lap);
    let factor = lapFactor - gauFactor;
    let threshold = min(uniforms.params[colId].threshold + clamp(factor, 0.0, 1.0), 0.9);

    let res = select(8u, colId, pres < threshold);
    let outPixel = u32(res) | (0xFFu << 8u) | (0x00u << 16u) | (0xFFu << 24u); // 0xCCIIPPFF
    imageOut[u32(index)] = outPixel;
  }
`;

const denoise3x3ShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<u32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<u32>;

  const dirs = array<vec2<i32>, 8>(
    vec2<i32>(0, -1), vec2<i32>(-1, 0), vec2<i32>(1, 0), vec2<i32>(0, 1),
    vec2<i32>(-1, -1), vec2<i32>(1, -1), vec2<i32>(-1, 1), vec2<i32>(1, 1),
  );

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) {
      return;
    }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let index = y * w + x;

    let pixel = imageIn[u32(index)];
    // col = 0xCCIIPPFF: C: color index, I: intensity, P: padding, F: always 255
    let colId = (pixel >> 0u) & 0xFFu; // 下位8ビットに色IDが入っている

    // dirsの方向をチェックして、同じ色がなければ最も多い隣接色に置き換え
    var counts = array<u32, 5>(0u, 0u, 0u, 0u, 0u); // 黒, 赤, 緑, 青, 白
    for (var i = 0; i < 8; i++) {
      let dx = dirs[i].x;
      let dy = dirs[i].y;
      let sx = clamp(x + dx, 0, w - 1);
      let sy = clamp(y + dy, 0, i32(height) - 1);
      let sampleIndex = sy * w + sx;
      let samplePixel = imageIn[u32(sampleIndex)];
      let sampleColId = (samplePixel >> 0u ) & 0xFFu;
      counts[u32(sampleColId)] += 1u;
    }
    // 自分と同じ色が1つもなければ、最も多い隣接色に置き換え
    if (counts[u32(colId)] > 0u) {
      let outPixel = colId | (0xFFu << 8u) | (0x00u << 16u) | (0xFFu << 24u);
      imageOut[u32(index)] = outPixel;
      return;
    }
    var maxCount = counts[0];
    var maxIdx: u32 = 0u;
    for (var i: u32 = 0u; i < 5u; i++) {
      if (counts[i] > maxCount) {
        maxCount = counts[i];
        maxIdx = i;
      }
    }
    // col = 0xCCIIPPFF: C: color index, I: intensity, P: padding, F: always 255
    let outPixel = maxIdx | (0xFFu << 8u) | (0x00u << 16u) | (0xFFu << 24u);
    imageOut[u32(index)] = outPixel;
  }
`;

const denoise5x5ShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<u32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<u32>;

  const outer = array<vec2<i32>, 16>(
    vec2<i32>(-2,-2), vec2<i32>(-2, 2), vec2<i32>(2, 2), vec2<i32>( 2,-2),
    vec2<i32>(-2,-1), vec2<i32>(-1, 2), vec2<i32>(2, 1), vec2<i32>( 1,-2),
    vec2<i32>(-2, 0), vec2<i32>( 0, 2), vec2<i32>(2, 0), vec2<i32>( 0,-2),
    vec2<i32>(-2, 1), vec2<i32>( 1, 2), vec2<i32>(2,-1), vec2<i32>(-1,-2),
  );
  
  const inner = array<vec2<i32>, 8>(
    vec2<i32>(0, -1), vec2<i32>(-1, 0), vec2<i32>(1, 0), vec2<i32>(0, 1),
    vec2<i32>(-1, -1), vec2<i32>(1, -1), vec2<i32>(-1, 1), vec2<i32>(1, 1),
  );

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) {
      return;
    }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let index = y * w + x;

    let pixel = imageIn[u32(index)];
    // col = 0xCCIIPPFF: C: color index, I: intensity, P: padding, F: always 255
    let colId = (pixel >> 0u) & 0xFFu; // 0-7bit: 色ID

    if (colId == 4u) {
      let outPixel = colId | (0xFFu << 8u) | (0x00u << 16u) | (0xFFu << 24u);
      imageOut[u32(index)] = outPixel;
      return;
    }

    // --- Step1: 外周チェック ---
    var outerFound = false;
    for (var i = 0; i < 16; i++) {
      let dx = outer[i].x;
      let dy = outer[i].y;
      let sx = clamp(x + dx, 0, w - 1);
      let sy = clamp(y + dy, 0, i32(height) - 1);
      let sample = imageIn[u32(sy * w + sx)];
      if ((sample & 0xFFu) == colId) {
        outerFound = true;
        break;
      }
    }

    // --- Step2: 3x3 内側カウント ---
    var innerCount = 1u; // 自分自身を含める
    for (var i = 0; i < 8; i++) {
      let dx = inner[i].x;
      let dy = inner[i].y;
      let sx = clamp(x + dx, 0, w - 1);
      let sy = clamp(y + dy, 0, i32(height) - 1);
      let sample = imageIn[u32(sy * w + sx)];
      if ((sample & 0xFFu) == colId) {
        innerCount++;
      }
    }

    // --- Step3: 5x5 多数決 ---
    var counts = array<u32, 5>(0u, 0u, 0u, 0u, 0u);
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        let sx = clamp(x + dx, 0, w - 1);
        let sy = clamp(y + dy, 0, i32(height) - 1);
        let sample = imageIn[u32(sy * w + sx)];
        let cid = (sample & 0xFFu);
        counts[cid] += 1u;
      }
    }

    var maxCount = counts[0];
    var maxIdx: u32 = 0u;
    for (var i: u32 = 1u; i < 5u; i++) {
      if (counts[i] > maxCount) {
        maxCount = counts[i];
        maxIdx = i;
      }
    }

    // --- Step4: 判定 ---
    var outId: u32 = colId;
    if (outerFound) {
      outId = colId; // 外周に同色がある → ディテール → 残す
    } else {
      if (innerCount <= 3u) {
        outId = maxIdx; // ノイズ → 溶かす
      } else {
        outId = colId;  // ディテール → 残す
      }
    }

    // col = 0xCCIIPPFF: C: color index, I: intensity, P: padding, F: always 255
    let outPixel = outId | (0xFFu << 8u) | (0x00u << 16u) | (0xFFu << 24u);
    imageOut[u32(index)] = outPixel;
  }
`;

const colorIndexToColorShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<u32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<u32>;

  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    var idPallet: array<vec3f, 9>;
    for (var i: u32 = 0u; i < 8u; i = i + 1u) {
      let pix = u32(uniforms.params[i].labelCol);
      var r = f32((pix >> 0u) & 0xFFu);
      var g = f32((pix >> 8u) & 0xFFu);
      var b = f32((pix >> 16u) & 0xFFu);
      idPallet[i] = vec3f(r, g, b);
    }
    idPallet[8] = vec3f(255.,255.,255.);

    if (global_id.x >= width || global_id.y >= height) {
      return;
    }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let index = y * w + x;
    let pixelIn = imageIn[u32(index)];

    let colId = (pixelIn >> 0u ) & 0xFFu; // 下位8ビットに色IDが入っている
    let intensity = (pixelIn >> 8u) & 0xFFu; // 上位8ビットに色値が入っている
    let col = idPallet[u32(colId)] * (f32(intensity) / 255.0);
    let outPixel = u32(col.r) | (u32(col.g) << 8u) | (u32(col.b) << 16u) | (0xFFu << 24u);
    imageOut[u32(index)] = outPixel;
  }
`;

const outputFloatShaderCode = /* glsl */`
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  @group(0) @binding(1) var<storage, read> imageIn: array<f32>;
  @group(0) @binding(2) var<storage, read_write> imageOut: array<u32>;
  
  @compute @workgroup_size(8, 8)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let width = uniforms.width;
    let height = uniforms.height;

    if (global_id.x >= width || global_id.y >= height) {
      return;
    }

    let x = i32(global_id.x);
    let y = i32(global_id.y);
    let w = i32(width);
    let index = y * w + x;

    // imageIn[0-1] を imageOut[0-255] に変換して出力
    let fVal = clamp(imageIn[u32(index)], 0.0, 1.0);
    let gray = u32(fVal * 255.0);
    let outPixel = gray | (gray << 8u) | (gray << 16u) | (0xFFu << 24u);
    imageOut[u32(index)] = outPixel;
  }
`;
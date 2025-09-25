// --- WebGPU初期化 ---
let device = null;
const workgroupSize = 8;
async function initWebGPU() {
  if (!navigator.gpu) {
    showStatus('WebGPUはこのブラウザでサポートされていません', 'error');
    return false;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    showStatus('WebGPUアダプター取得に失敗しました', 'error');
    return false;
  }
  device = await adapter.requestDevice();
  showStatus('WebGPUが初期化されました', 'success', 3000);
  return true;
}

// --- 画像処理 ---
function preparePipelines(imageData, drawImageData, cfg) {
  const width = imageData.width;
  const height = imageData.height;
  const pixelCount = width * height;
  const colBlks = cfg.colorBlocks;
  const cbKeys = Object.keys(cfg.colorBlocks);
 
  const uniSize = Math.ceil((8 * 8 + 4) / 4) * 4;
  const buffers = {
    uniform: device.createBuffer({ size: uniSize * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
    input: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
    drawInput: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
    // DEBUG: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    pSharp: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    pressure: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    pressureOut: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    binary: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    gaussian: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    logBuffer: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    log: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    logOut: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    preDenoise: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    denoiseBuffer: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    output: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
    readbackPressure: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
    readbackLoG: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
    readbackpDen: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
    readback: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
    readbackDEB: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
  };
  const pixelArray = new Uint32Array(imageData.data.buffer);
  device.queue.writeBuffer(buffers.input, 0, pixelArray);
 
  if (drawImageData){
    const pixelArray2 = new Uint32Array(drawImageData.data.buffer);
    device.queue.writeBuffer(buffers.drawInput, 0, pixelArray2);
  }
 
  // width, height は u32、threshold は f32
  makeUniformsCodes();
  const uniformArray = new ArrayBuffer(uniSize * 4);
  const u32View = new Uint32Array(uniformArray);
  const f32View = new Float32Array(uniformArray);
  u32View[0] = width;
  u32View[1] = height;
  u32View[2] = cbKeys.length;
  const bgCol = hexToInt32(cfg.bgColor);
  u32View[3] = bgCol;
 
  const [firstKey, ...restKeys] = cbKeys;
  const sortedRest = restKeys
    .map(key => {
      const hex    = cfg.colorBlocks[key].color;
      const colInt = hexToInt32(hex);
      return { key, hue: hexToHue(colInt) };
    })
    .sort((a, b) => a.hue - b.hue)
    .map(obj => obj.key);
  const sortedKeys = [firstKey, ...sortedRest];
 
  const base = 4;
  for(let i = 0; i < sortedKeys.length; ++i){ // 各色毎（黒, 赤, 緑, 青, ...）
    const k = sortedKeys[i];
    const src = colBlks[k];
 
    f32View[i*8 + base + 0] = hexToInt32(src.color);
    f32View[i*8 + base + 1] = hexToInt32(src.labelColor);
 
    // sliders (frame config now holds absolute values)
    const t = src.sliders.threshold;
    const l = src.sliders.log;
    const w = src.sliders.weight;
    f32View[i * 8 + base + 2] = t;
    f32View[i * 8 + base + 3] = l;
    f32View[i * 8 + base + 4] = w;
  }
  device.queue.writeBuffer(buffers.uniform, 0, uniformArray);
 
  const steps = [
    {
      name: 'TracePressure',
      code: uniformsCode + tracePressShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'input', binding: 1, type: 'read-only-storage' },
        { name: 'drawInput', binding: 2, type: 'read-only-storage' },
        { name: 'pSharp', binding: 3, type: 'storage' },
        { name: 'binary', binding: 4, type: 'storage' },
        // { name: 'DEBUG', binding: 4, type: 'storage' },
      ]
    },
    { // 筆圧値：シャープネスフィルタ
      name: 'Sharpness',
      code: uniformsCode + sharpnessShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'pSharp', binding: 1, type: 'read-only-storage' },
        { name: 'pressure', binding: 2, type: 'storage' },
      ]
    },
    { // 筆圧値：Floatをグレーに変換
      name: 'Pres_Pressure',
      code: uniformsCode + outputFloatShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'pressure', binding: 1, type: 'read-only-storage' },
        { name: 'pressureOut', binding: 2, type: 'storage' },
      ]
    },
    {
      name: 'LoG_Gaussian',
      code: uniformsCode + gaussianShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'pressure', binding: 1, type: 'read-only-storage' },
        { name: 'log', binding: 2, type: 'storage' },
      ]
    },
    {
      name: 'LoG_Laplacian',
      code: uniformsCode + laplacianShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'log', binding: 1, type: 'read-only-storage' },
        { name: 'binary', binding: 2, type: 'read-only-storage' },
        { name: 'logBuffer', binding: 3, type: 'storage' },
      ]
    },
    {
      name: 'LoG_Gaussian2',
      code: uniformsCode + gaussianShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'logBuffer', binding: 1, type: 'read-only-storage' },
        { name: 'log', binding: 2, type: 'storage' },
      ]
    },
    { // LoGフィルタ：Floatをグレーに変換
      name: 'DebugOutputLoG',
      code: uniformsCode + outputFloatShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'log', binding: 1, type: 'read-only-storage' },
        { name: 'logOut', binding: 2, type: 'storage' },
      ]
    },
    {
      name: 'Gau_Gaussian',
      code: uniformsCode + gaussianMultColShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'binary', binding: 1, type: 'read-only-storage' },
        { name: 'gaussian', binding: 2, type: 'storage' },
      ]
    },
    {
      name: 'AffineBinary',
      code: uniformsCode + affineBinaryShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'pressure', binding: 1, type: 'read-only-storage' },
        { name: 'log', binding: 2, type: 'read-only-storage' },
        { name: 'gaussian', binding: 3, type: 'read-only-storage' },
        { name: 'preDenoise', binding: 4, type: 'storage' },
      ]
    },
    {
      name: 'Denoise5x5',
      code: uniformsCode + denoise5x5ShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'preDenoise', binding: 1, type: 'read-only-storage' },
        { name: 'denoiseBuffer', binding: 2, type: 'storage' },
      ]
    },
    {
      name: 'Denoise3x3',
      code: uniformsCode + denoise3x3ShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'denoiseBuffer', binding: 1, type: 'read-only-storage' },
        { name: 'binary', binding: 2, type: 'storage' },
      ]
    },
    { // 最終結果：最終結果を色に変換
      name: 'ColorIndexToColor',
      code: uniformsCode + colorIndexToColorShaderCode,
      bindings: [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'binary', binding: 1, type: 'read-only-storage' },
        { name: 'output', binding: 2, type: 'storage' },
      ]
    },
  ];
 
  return { buffers, steps, width, height };
}

let gpuProcessing = false;
async function processImage(idx) {
  imageData = uploadedImages[idx];
  drawImageData = drawImages[idx];
  if (!device || !imageData) return showStatus('準備が整っていません', 'error', 3000);
  if (gpuProcessing) return;
  gpuProcessing = true;
  showStatus('<div class="loading"><div class="spinner"></div>WebGPUで処理中...</div>');
  try {

    const cfgToUse = (frameConfigs && frameConfigs[idx]) ? frameConfigs[idx] : globalConfig;
    const { buffers, steps, width, height } = preparePipelines(imageData, drawImageData, cfgToUse);

    for (const step of steps) {
      const encoder = await runShader(step.code, buffers, step.bindings, width, height);
      device.queue.submit([encoder.finish()]);
    }
    
    // モードと対応する readback バッファを定義 // [modename]: [readbackBufferName]
    const modeToBuffer = {
      pressure: "readbackPressure",
      log: "readbackLoG",
      processed: "readback",
      // DEBUG: "readbackDEB",
    };

    const encoder = device.createCommandEncoder();
    // 処理結果を readback バッファにコピー // [outputBufferName, readbackBufferName]
    const copyMap = [
      ["pressureOut", "readbackPressure"],
      ["logOut", "readbackLoG"],
      ["output", "readback"],
      // ["DEBUG", "readbackDEB"],
    ];

    for (const [src, dst] of copyMap) {
      encoder.copyBufferToBuffer(buffers[src], 0, buffers[dst], 0, width * height * 4);
    }
    device.queue.submit([encoder.finish()]);

    for(const key of Object.keys(modeToBuffer)){
      const bufferKey = modeToBuffer[key];
      const buffer = buffers[bufferKey];
      // 読み込み
      await buffer.mapAsync(GPUMapMode.READ);
      const result = new Uint32Array(buffer.getMappedRange());
      // 表示
      cacheProcessedImage(result, width, height);
      // 後処理
      buffer.unmap();

      processedImages[key][idx] = {
        img: osctx.getImageData(0, 0, canvas.width, canvas.height),
        phase: updatePhase,
      };
    }
    
    showStatus('処理が完了しました', 'success', 3000);
  } finally {
    gpuProcessing = false;
  }
}

// ImageData保存
function cacheProcessedImage(outputArray, width, height) {
  // Uint32Array か Uint8Array かを判別して Uint8ClampedArray に変換
  let u8;
  if (outputArray instanceof Uint32Array) {
    u8 = new Uint8ClampedArray(outputArray.buffer);
  } else {
    // denoise 後は Uint8Array なのでそのまま
    u8 = new Uint8ClampedArray(outputArray.buffer);
  }
  const imageData = new ImageData(u8, width, height);
  osctx.putImageData(imageData, 0, 0);
}

// --- GPU処理実行 ---
async function runShader(shaderCode, buffers, bindings, width, height) {
  const shaderModule = device.createShaderModule({ code: shaderCode });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: bindings.map(({ binding, type }) => ({
      binding,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type }
    }))
  });

  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    compute: { module: shaderModule, entryPoint: 'main' }
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: bindings.map(({ binding, name }) => ({
      binding,
      resource: { buffer: buffers[name] }
    }))
  });

  const commandEncoder = device.createCommandEncoder();
  const pass = commandEncoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(
    Math.ceil(width / workgroupSize),
    Math.ceil(height / workgroupSize)
  );
  pass.end();
  return commandEncoder;
}
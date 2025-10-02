(function(){
  // --- WebGPU初期化 ---
  let device = null;
  const workgroupSize = 8;

  // --- Pipeline & shader cache ---
  // Cache pipelines, shader modules and bind group layouts so we don't recreate them every dispatch.
  // Key is derived from shader code + binding signature to ensure uniqueness for a pipeline layout.
  const pipelineCache = new Map();

  function _makeBindingLayoutEntries(bindings){
    return bindings.map(({binding, type}) => ({
      binding,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type }
    }));
  }

  function getOrCreatePipeline(shaderCode, bindings){
    const key = shaderCode + '|' + JSON.stringify(bindings.map(b => ({ binding: b.binding, type: b.type })));
    if (pipelineCache.has(key)) return pipelineCache.get(key);

    const shaderModule = device.createShaderModule({ code: shaderCode });
    const bindGroupLayout = device.createBindGroupLayout({
      entries: _makeBindingLayoutEntries(bindings)
    });

    const pipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      compute: { module: shaderModule, entryPoint: 'main' }
    });

    const entry = { pipeline, bindGroupLayout, shaderModule };
    pipelineCache.set(key, entry);
    return entry;
  }

  async function init() {
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
    const bgCol = hexToInt32(cfg.bgColor + `0${cfg.colorBlocks.length}`);
    const bgLCol = hexToInt32(cfg.bgLabelColor);
    u32View[2] = bgCol;
    u32View[3] = bgLCol;

    const sorted = [
      cfg.colorBlocks[0], // インデックス0は固定
      ...cfg.colorBlocks.slice(1).sort((a, b) => hexToHue(a.color) - hexToHue(b.color))
    ];

    const base = 4;
    for(let i = 0; i < sorted.length; ++i){ // 各色毎（黒, 赤, 緑, 青, ...）
      const src = sorted[i];
    
      f32View[i*8 + base + 0] = hexToInt32(src.color);
      // If the color block is disabled (enabled === false), use the background label color
      const labelInt = (src.enabled === false) ? bgLCol : hexToInt32(src.labelColor);
      f32View[i*8 + base + 1] = labelInt;
    
      // sliders (frame config now holds absolute values)
      const t = src.sliders.threshold * 0.01;
      const l = src.sliders.log * 0.1;
      const w = src.sliders.weight * 0.1;
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

  async function processImage(imageData, drawImageData, cfg, idx) {
    if (!device || !imageData) return showStatus('準備が整っていません', 'error', 3000);
    showStatus('<div class="loading"><div class="spinner"></div>WebGPUで処理中...</div>');
    const { buffers, steps, width, height } = preparePipelines(imageData, drawImageData, cfg);

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

    const processedData = {};
    for(const key of Object.keys(modeToBuffer)){
      const bufferKey = modeToBuffer[key];
      const buffer = buffers[bufferKey];
      // 読み込み
      await buffer.mapAsync(GPUMapMode.READ);
      const mappedRange = buffer.getMappedRange();
      const result = new Uint8Array(mappedRange);
      // コピー
      const copy = new Uint8ClampedArray(result);
      // 保存
      const resImageData = new ImageData(copy, width, height);
      processedData[key] = resImageData;
      // 後処理
      buffer.unmap();
    }

    window.Core.setProcessedData(processedData, idx);
    
    showStatus('処理が完了しました', 'success', 3000);
  }

  // --- GPU処理実行 ---
  async function runShader(shaderCode, buffers, bindings, width, height) {
    // Reuse pipeline/bind group layout/shader module where possible.
    const { pipeline, bindGroupLayout } = getOrCreatePipeline(shaderCode, bindings);

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

  window.WebGPUProcessor = {
    init,
    processImage
  }

})();
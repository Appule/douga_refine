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
      readback: device.createBuffer({ size: pixelCount * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
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
    
    const enableSharpness = (typeof cfg.enableSharpness !== 'undefined') ? cfg.enableSharpness : true;
    const denoiseLevel = (typeof cfg.denoiseLevel !== 'undefined') ? cfg.denoiseLevel : 3;
    const enableDebug   = (typeof cfg.enableDebug !== 'undefined')   ? cfg.enableDebug : false;

    device.queue.writeBuffer(buffers.uniform, 0, uniformArray);

    // Helper to push a step
    function pushStep(arr, name, code, bindings) {
      arr.push({ name, code, bindings });
    }

    const steps = [];

    // TracePressure: pSharp or pressure depending on sharpness flag
    pushStep(steps, 'TracePressure', uniformsCode + tracePressShaderCode, [
      { name: 'uniform', binding: 0, type: 'uniform' },
      { name: 'input', binding: 1, type: 'read-only-storage' },
      { name: 'drawInput', binding: 2, type: 'read-only-storage' },
      { name: (enableSharpness ? 'pSharp' : 'pressure'), binding: 3, type: 'storage' },
      { name: 'binary', binding: 4, type: 'storage' },
    ]);

    // Sharpness: only when enabled
    if (enableSharpness) {
      pushStep(steps, 'Sharpness', uniformsCode + sharpnessShaderCode, [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'pSharp', binding: 1, type: 'read-only-storage' },
        { name: 'pressure', binding: 2, type: 'storage' },
      ]);
    }

    // Pres_Pressure: only for debug output (float-to-gray debug path)
    if (enableDebug) {
      pushStep(steps, 'Pres_Pressure', uniformsCode + outputFloatShaderCode, [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'pressure', binding: 1, type: 'read-only-storage' },
        { name: 'pressureOut', binding: 2, type: 'storage' },
      ]);
    }

    // LoG processing (always present)
    pushStep(steps, 'LoG_Gaussian', uniformsCode + gaussianShaderCode, [
      { name: 'uniform', binding: 0, type: 'uniform' },
      { name: 'pressure', binding: 1, type: 'read-only-storage' },
      { name: 'log', binding: 2, type: 'storage' },
    ]);

    pushStep(steps, 'LoG_Laplacian', uniformsCode + laplacianShaderCode, [
      { name: 'uniform', binding: 0, type: 'uniform' },
      { name: 'log', binding: 1, type: 'read-only-storage' },
      { name: 'binary', binding: 2, type: 'read-only-storage' },
      { name: 'logBuffer', binding: 3, type: 'storage' },
    ]);

    pushStep(steps, 'LoG_Gaussian2', uniformsCode + gaussianShaderCode, [
      { name: 'uniform', binding: 0, type: 'uniform' },
      { name: 'logBuffer', binding: 1, type: 'read-only-storage' },
      { name: 'log', binding: 2, type: 'storage' },
    ]);

    // Debug LoG output: only when debug enabled
    if (enableDebug) {
      pushStep(steps, 'DebugOutputLoG', uniformsCode + outputFloatShaderCode, [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'log', binding: 1, type: 'read-only-storage' },
        { name: 'logOut', binding: 2, type: 'storage' },
      ]);
    }

    // Gaussian multicolor step
    pushStep(steps, 'Gau_Gaussian', uniformsCode + gaussianMultColShaderCode, [
      { name: 'uniform', binding: 0, type: 'uniform' },
      { name: 'binary', binding: 1, type: 'read-only-storage' },
      { name: 'gaussian', binding: 2, type: 'storage' },
    ]);

    // AffineBinary: preDenoise target depends on denoise flag
    let preDenoiseName = 'preDenoise';
    if (denoiseLevel === 1 || denoiseLevel === 2) preDenoiseName = 'denoiseBuffer';
    if (denoiseLevel === 0) preDenoiseName = 'binary';

    pushStep(steps, 'AffineBinary', uniformsCode + affineBinaryShaderCode, [
      { name: 'uniform', binding: 0, type: 'uniform' },
      { name: 'pressure', binding: 1, type: 'read-only-storage' },
      { name: 'log', binding: 2, type: 'read-only-storage' },
      { name: 'gaussian', binding: 3, type: 'read-only-storage' },
      { name: preDenoiseName, binding: 4, type: 'storage' },
    ]);

    // Denoise steps: 3x3 then 1x1 when enabled
    if (denoiseLevel === 3) {
      // full denoise: AffineBinary -> preDenoise -> Denoise3x3 -> denoiseBuffer -> Denoise1x1 -> binary
      pushStep(steps, 'Denoise3x3', uniformsCode + denoise3x3ShaderCode, [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'preDenoise', binding: 1, type: 'read-only-storage' },
        { name: 'denoiseBuffer', binding: 2, type: 'storage' },
      ]);
      pushStep(steps, 'Denoise1x1', uniformsCode + denoise1x1ShaderCode, [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'denoiseBuffer', binding: 1, type: 'read-only-storage' },
        { name: 'binary', binding: 2, type: 'storage' },
      ]);
    } else if(denoiseLevel === 2) {
      pushStep(steps, 'Denoise2x2', uniformsCode + denoise2x2ShaderCode, [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'denoiseBuffer', binding: 1, type: 'read-only-storage' },
        { name: 'binary', binding: 2, type: 'storage' },
      ]);
    } else if (denoiseLevel === 1) {
      pushStep(steps, 'Denoise1x1', uniformsCode + denoise1x1ShaderCode, [
        { name: 'uniform', binding: 0, type: 'uniform' },
        { name: 'denoiseBuffer', binding: 1, type: 'read-only-storage' },
        { name: 'binary', binding: 2, type: 'storage' },
      ]);
    }

    // Final colorization
    pushStep(steps, 'ColorIndexToColor', uniformsCode + colorIndexToColorShaderCode, [
      { name: 'uniform', binding: 0, type: 'uniform' },
      { name: 'binary', binding: 1, type: 'read-only-storage' },
      { name: 'output', binding: 2, type: 'storage' },
    ]);

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
    
    // モードと対応する readback バッファを定義（cfg.enableDebug によって切り替え）
    const enableDebug = (typeof cfg.enableDebug !== 'undefined') ? cfg.enableDebug : false;
    const modeToBuffer = enableDebug ? {
      pressure: "readbackPressure",
      log: "readbackLoG",
      processed: "readback",
    } : {
      processed: "readback",
    };
  
    const encoder = device.createCommandEncoder();
    // 処理結果を readback バッファにコピー（debug が無効なら output のみコピー）
    const copyMap = [];
    if (enableDebug) {
      copyMap.push(["pressureOut", "readbackPressure"]);
      copyMap.push(["logOut", "readbackLoG"]);
    }
    copyMap.push(["output", "readback"]);
  
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
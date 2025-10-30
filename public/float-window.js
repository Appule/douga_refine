// --- FloatWindow Class ---
class FloatWindow {
  /**
   * @param {string} id - DOMのID
   * @param {Object} windowPosition - windowの初期位置
   * @param {Object} windowSize - windowの初期サイズ
   * @param {string} backgroundColor - CSSの色指定 (例: 'rgba(255, 200, 200, 0.9)')
   */
  constructor(id, windowPosition, windowSize, backgroundColor = 'rgba(255, 255, 255, 0.52)') {
    this.topZIndex = 100;
    this.minWidth = 100;
    this.minHeight = 100;

    this.el = document.getElementById(id);

    this.container = document.createElement('div');
    this.container.className = 'scroll-container';
    this.el.appendChild(this.container);
    this.el.style.backgroundColor = backgroundColor;
    this.el.style.zIndex = this.topZIndex;

    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;

    this.pixel = {
      x: windowPosition.x,
      y: windowPosition.y,
      width: windowSize.width,
      height: windowSize.height
    }

    this.relative = {
      x: windowPosition.x / this.viewportWidth,
      y: windowPosition.y / this.viewportHeight,
      width: windowSize.width / this.viewportWidth,
      height: windowSize.height / this.viewportHeight
    }

    this._applyPixelSizeAndPosition(this.pixel.width, this.pixel.height, this.pixel.x, this.pixel.y);

    this.el.addEventListener('mousedown', () => {
      this.topZIndex++;
      this.el.style.zIndex = this.topZIndex;
    });
    this.el.addEventListener('mouseup', () => {
      // update pixel data
      this.pixel.x = this.el.getAttribute('data-x');
      this.pixel.y = this.el.getAttribute('data-y');
      this.pixel.width = parseInt(this.el.style.width.replace('px', ''));
      this.pixel.height = parseInt(this.el.style.height.replace('px', ''));
      this._updateRelativeFromPixel();
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
      inertia: false,
      edges: { left: true, right: true, bottom: true, top: true },
      listeners: {
        move(event) {
          const target = event.target;
          let { width, height } = event.rect;
          target.style.width = `${width - 22}px`;
          target.style.height = `${height - 22}px`;
          let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.deltaRect.left;
          let y = (parseFloat(target.getAttribute('data-y')) || 0) + event.deltaRect.top;
          target.style.transform = `translate(${x}px, ${y}px)`;
          target.setAttribute('data-x', x);
          target.setAttribute('data-y', y);
        }
      },
      modifiers: [
        interact.modifiers.restrictSize({
          min: { width: this.minWidth, height: this.minHeight }
        }),
        interact.modifiers.restrictEdges({
          outer: 'parent'
        }),
      ]
    });

    this._onWindowResize = this._onWindowResize.bind(this);
    window.addEventListener('resize', this._onWindowResize);

  }

  _applyPixelSizeAndPosition(widthPx, heightPx, xPx, yPx) {
    this.el.style.width = `${widthPx - 22}px`;
    this.el.style.height = `${heightPx - 22}px`;
    this.el.style.transform = `translate(${xPx}px, ${yPx}px)`;
    this.el.setAttribute('data-x', xPx);
    this.el.setAttribute('data-y', yPx);
  }

  _updateRelativeFromPixel() {
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.relative.x = this.pixel.x / Math.max(1, this.viewportWidth);
    this.relative.y = this.pixel.y / Math.max(1, this.viewportHeight);
    this.relative.width = this.pixel.width / Math.max(1, this.viewportWidth);
    this.relative.height = this.pixel.height / Math.max(1, this.viewportHeight);
  }

  _applyRelativeToPixelAndRender() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 新しいピクセル値を計算
    let newWidth = Math.round(this.relative.width * vw);
    let newHeight = Math.round(this.relative.height * vh);
    let newX = Math.round(this.relative.x * vw);
    let newY = Math.round(this.relative.y * vh);

    // 最低サイズを守る（interact の最小値と一致）
    if (newWidth < this.minWidth) newWidth = this.minWidth;
    if (newHeight < this.minHeight) newHeight = this.minHeight;

    // 親要素の範囲内に収める（オプション：親境界を超えないように）
    const parent = this.el.parentElement;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      const maxX = Math.max(0, parentRect.width - newWidth);
      const maxY = Math.max(0, parentRect.height - newHeight);
      if (newX > maxX) newX = maxX;
      if (newY > maxY) newY = maxY;
    }

    // 状態を更新して適用
    this.pixel.width = newWidth;
    this.pixel.height = newHeight;
    this.pixel.x = newX;
    this.pixel.y = newY;
    this._applyPixelSizeAndPosition(newWidth, newHeight, newX, newY);
  }

  // window.resize イベントハンドラ
  _onWindowResize() {
    // ビューポートが変わったので、relative 値をもとに新しいピクセルを適用
    this._applyRelativeToPixelAndRender();
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

  addElement(element, container = this.container) {
    container.appendChild(element);
  }

  clearElements(container = this.container) {
    container.innerHTML = '';
  }

  getContainer() {
    return this.container;
  }
}

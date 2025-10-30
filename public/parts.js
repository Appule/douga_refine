//// window global

// Add Label
function createLabel(label) {
  const labelEl = document.createElement('div');
  labelEl.textContent = `${label}`;
  labelEl.style.width = '100%';
  labelEl.style.marginTop = '2px';
  labelEl.style.padding = "2px";
  labelEl.style.fontSize = "14px";
  return labelEl;
}

// Add Button
function createButton(label, onClick, color = 'rgb(92, 92, 92)') {
  const btn = document.createElement('button');
  btn.innerHTML = `${label}`;
  btn.style.width = '100%';
  btn.style.marginTop = '2px';
  btn.style.padding = "6px";
  btn.style.border = "none";
  btn.style.fontSize = "14px";
  btn.style.color = 'white';
  btn.style.backgroundColor = color;

  btn.addEventListener('click', () => {
    if (typeof onClick === 'function') onClick();
  });
  btn.addEventListener('mousedown', () => {
    btn.classList.add('active');
  });
  btn.addEventListener('mouseup', () => {
    btn.classList.remove('active');
  });
  btn.addEventListener('mouseleave', () => {
    btn.classList.remove('active');
  });

  return btn;
}

// Add Wrapper
function createWrapper(btns, widths) {
  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';

  btns.forEach((b, i) => {
    b.style.width = widths[i];
    if (i != 0) b.style.marginLeft = '1px';
    if (i != btns.length - 1) b.style.marginRight = '1px';
    wrapper.appendChild(b);
  });

  return wrapper;
}

// Add Toggle Button
function createToggle(label, initialState = false, onToggle, activeColor = 'rgb(0,153,221)', inactiveColor = 'rgb(92,92,92)') {
  const btn = document.createElement('button');
  btn.innerHTML = `${label}`;
  btn.style.marginTop = '2px';
  btn.style.width = '100%';
  btn.style.border = "none";
  btn.style.padding = "6px";
  btn.style.fontSize = "14px";
  btn.style.color = 'white';
  btn.dataset.toggled = initialState ? '1' : '0';

  const applyBg = (toggled) => {
    btn.style.backgroundColor = toggled ? activeColor : inactiveColor;
    btn.setAttribute('aria-pressed', toggled ? 'true' : 'false');
  };
  applyBg(initialState);

  const toggle = () => {
    const was = btn.dataset.toggled === '1';
    const now = !was;
    btn.dataset.toggled = now ? '1' : '0';
    applyBg(now);
    if (typeof onToggle === 'function') onToggle(now);
  };

  btn.addEventListener('click', () => {
    toggle();
  });

  return btn;
}

// Add Text Input
function createTextInput(label, onChange) {
  const input = document.createElement('input');

  input.placeholder = label;
  input.style.width = '100%';
  input.style.boxSizing = 'border-box';
  input.style.padding = "6px";
  input.style.fontSize = "14px";
  input.style.marginTop = '2px';

  input.addEventListener('input', () => {
    onChange(input.value);
  });

  return input;
}

// Add Dropdown
function createDropdown(label, options = [], onChange, color = 'rgba(92, 92, 92, 1)') {
  // セレクトボックス
  const select = document.createElement('select');
  select.style.width = '100%';
  select.style.marginTop = '2px';
  select.style.padding = '6px';
  select.style.border = 'none';
  select.style.backgroundColor = color;
  select.style.color = 'white';
  select.style.fontSize = '14px';
  select.style.cursor = 'pointer';
  select.style.textAlign = 'center';

  // 選択肢を追加
  if (options.length == 0) {
    const option = document.createElement('option');
    option.value = 0;
    option.textContent = label;
    select.appendChild(option);
  } else {
    options.forEach(opt => {
      const option = document.createElement('option');
      if (typeof opt === 'string') {
        option.value = opt;
        option.textContent = (label === '' ? '' : label + '：') + opt;
      } else {
        // { value: 'val', text: '表示名' } 形式もサポート
        option.value = opt.value;
        option.textContent = (label === '' ? '' : label + '：') + opt.text;
      }
      select.appendChild(option);
    });
  }

  // イベント
  select.addEventListener('change', () => {
    if (typeof onChange === 'function') onChange(select.value);
  });

  return select;
}


//// window config




//// window frames
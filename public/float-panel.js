(function () {

  //// 参照と保存
  let refDropdown = null;
  let savDropdown = null;
  let fileNameInput = null;
  let fileExtList = null;
  let selectCutFolderCallBack = () => { };
  let refDropdownCallBack = () => { };
  let fileNameInputCallBack = () => { };
  let fileExtListCallBack = () => { };
  let saveAllBtnCallBack = () => { };
  const setSelectCutFolderCallBack = function (func) { selectCutFolderCallBack = func; };
  const setRefDropdownCallBack = function (func) { refDropdownCallBack = func; };
  const setFileNameInputCallBack = function (func) { fileNameInputCallBack = func; };
  const setFileExtListCallBack = function (func) { fileExtListCallBack = func; };
  const setSaveAllBtnCallBack = function (func) { saveAllBtnCallBack = func; };
  //// 表示切替
  let showInCallBack = () => { };
  let showOutCallBack = () => { };
  let showRefCallBack = () => { };
  //// 出力の調整
  let sharpnessBtn = null;
  let denoiseLevelList = null;
  let cursorModeList = null;
  let sharpnessBtnCallBack = () => { };
  let denoiseLevelListCallBack = () => { };
  let cursorModeListCallBack = () => { };
  const setSharpnessBtnCallBack = function (func) { sharpnessBtnCallBack = func; };
  const setDenoiseLevelListCallBack = function (func) { denoiseLevelListCallBack = func; };
  const setCursorModeListCallBack = function (func) { cursorModeListCallBack = func; };

  // フロートウィンドウの初期設定
  const init = function () {
    const gWin = new FloatWindow('window-global', { x: 0, y: 0 }, { width: window.innerWidth * 0.1, height: window.innerHeight * 0.4 }, 'rgba(224, 230, 255, 0.52)');

    //// 参照と保存
    // DOMの設定
    gWin.addElement(createLabel('参照と保存'));
    gWin.addElement(createButton('<i class="fa-solid fa-folder-open"></i> カットフォルダ', () => { selectCutFolderCallBack() }, 'rgba(23, 135, 255, 1)'));
    {
      refDropdown = createDropdown('参照', [], (e) => { refDropdownCallBack(e); }, 'rgba(23, 135, 255, 1)');
      refDropdown.style.width = '100%';
      gWin.addElement(refDropdown);
    }
    {
      fileNameInput = createTextInput('保存名', (e) => { fileNameInputCallBack(e); });
      fileExtList = createDropdown('', [
        { value: 'tga', text: '.tga' },
        { value: 'png', text: '.png' },
        { value: 'tif', text: '.tif' },
      ], (e) => { fileExtListCallBack(e); }, 'rgba(23, 135, 255, 1)');
      const wrapper = createWrapper([fileNameInput, fileExtList], ['65%', '35%']);
      gWin.addElement(wrapper);
    }
    gWin.addElement(createButton('<i class="fas fa-file-download"></i> 全て保存', () => { saveAllBtnCallBack(); }, 'rgba(23, 135, 255, 1)'));

    // Callback Functionの設定
    function updateSelectOptions(selectElement, optionLabels) {
      // 1. 既存の option をすべて削除
      while (selectElement.firstChild) {
        selectElement.removeChild(selectElement.firstChild);
      }
      // 2. ダミーのoptionを追加
      const dummyOption = document.createElement('option');
      dummyOption.textContent = '参照フォルダを選択';
      dummyOption.value = ''; // valueを空にしておく
      dummyOption.disabled = true;
      dummyOption.selected = true;
      selectElement.appendChild(dummyOption);

      // 3. 新しい option を追加
      optionLabels.forEach((label) => {
        const option = document.createElement('option');
        option.textContent = label;
        option.value = label;
        selectElement.appendChild(option);
      });
    }
    const setRefDropdown = (labels) => { updateSelectOptions(refDropdown, labels) };


    //// 表示切替
    gWin.addElement(createLabel('表示切替'));
    gWin.addElement(createButton('<i class="fa-solid fa-image"></i> 入力画像', () => { showInCallBack(); }, 'rgb(0, 185, 40)'));
    gWin.addElement(createButton('<i class="fa-solid fa-images"></i> 参照画像', () => { showRefCallBack(); }, 'rgb(0, 185, 40)'));
    gWin.addElement(createButton('<i class="fa-regular fa-image"></i> 出力画像', () => { showOutCallBack(); }, 'rgb(0, 185, 40)'));
    const setShowInCallBack = function (func) { showInCallBack = func; }
    const setShowOutCallBack = function (func) { showOutCallBack = func; }
    const setShowRefCallBack = function (func) { showRefCallBack = func; }

    //// 出力の詳細設定
    gWin.addElement(createLabel('出力の詳細設定'));
    sharpnessBtn = createToggle('シャープネス', true, () => window.ConfigEditor.updateCurrentCfg(), 'rgba(255, 104, 104, 1)', 'rgba(114, 114, 114, 1)');
    denoiseLevelList = createDropdown('デノイズ強度', ['3', '2', '1', '0'], () => window.ConfigEditor.updateCurrentCfg(), 'rgba(82, 82, 82, 1)');
    cursorModeList = createDropdown('カーソル', [{ text: 'デフォルト', value: 'camera' }, { text: '閾値上げ', value: 'highTh' }, { text: '閾値下げ', value: 'lowTh' }],
      (e) => { cursorModeListCallBack(e); }, 'rgba(89, 98, 219, 1)');
    gWin.addElement(sharpnessBtn);
    gWin.addElement(denoiseLevelList);
    gWin.addElement(cursorModeList);

    const getFileName = function () { return fileNameInput.value.trim(); }
    const getFileExt = function () { return fileExtList.value; }
    const getCfgStats = function () { return { enableSharpness: parseInt(sharpnessBtn.dataset.toggled), denoiseLevel: parseInt(denoiseLevelList.value) }; }

    //// 共有オブジェクト
    window.FloatPanel = {
      updateFilenameInput,
      getFileName,
      getFileExt,
      getCfgStats,
      setSelectCutFolderCallBack,
      setRefDropdownCallBack,
      setFileNameInputCallBack,
      setFileExtListCallBack,
      setSaveAllBtnCallBack,
      setRefDropdown,
      setShowInCallBack,
      setShowOutCallBack,
      setShowRefCallBack,
      setSharpnessBtnCallBack,
      setDenoiseLevelListCallBack,
      setCursorModeListCallBack,
    }
  }

  const updateFilenameInput = function (fileName) {
    fileNameInput.value = fileName;
    fileNameInput.dispatchEvent(new Event('input'));
  }

  init();

})();
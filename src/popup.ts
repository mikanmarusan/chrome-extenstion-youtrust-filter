import { ErrorLogEntry, NotificationType } from './types';

// デフォルトのフィルター企業（空配列：ユーザーが明示的に追加する）
const DEFAULT_COMPANIES: string[] = [];

// 現在の設定
let filterEnabled = true;
let filteredCompanies: string[] = [];

// エラーログ管理
const ERROR_LOG_MAX_SIZE = 30;
let errorLog: ErrorLogEntry[] = [];

// DOM要素
const filterToggle = document.getElementById('filterToggle') as HTMLInputElement;
const companyInput = document.getElementById('companyInput') as HTMLInputElement;
const addButton = document.getElementById('addButton') as HTMLButtonElement;
const companyList = document.getElementById('companyList') as HTMLUListElement;
const filterCount = document.getElementById('filterCount') as HTMLSpanElement;

// エラーハンドリング関数
function logError(error: Error | unknown, context = ''): void {
  const errorEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    context: context
  };

  errorLog.push(errorEntry);

  // ログサイズ制限
  if (errorLog.length > ERROR_LOG_MAX_SIZE) {
    errorLog = errorLog.slice(-ERROR_LOG_MAX_SIZE);
  }

  // コンソールにも出力
  console.error(`[YOUTrust Filter Popup Error] ${context}:`, error);

  // ストレージに保存（プライバシーを考慮）
  try {
    chrome.storage.local.set({
      popupErrorLog: errorLog.map(e => ({
        timestamp: e.timestamp,
        message: e.message.substring(0, 100),
        context: e.context
      }))
    });
  } catch (storageError) {
    console.error('[YOUTrust Filter Popup] Failed to save error log:', storageError);
  }
}

// ユーザーへのフィードバック関数
function showUserFeedback(message: string, type: NotificationType = 'error'): void {
  try {
    // 既存のフィードバックを削除
    const existingFeedback = document.getElementById('user-feedback');
    if (existingFeedback) {
      existingFeedback.remove();
    }

    // 新しいフィードバック要素を作成
    const feedback = document.createElement('div');
    feedback.id = 'user-feedback';
    feedback.style.cssText = `
      padding: 8px 12px;
      margin: 10px 0;
      background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
      color: white;
      border-radius: 4px;
      font-size: 14px;
      text-align: center;
    `;
    feedback.textContent = message;

    // body要素の最初に挿入
    document.body.insertBefore(feedback, document.body.firstChild);

    // 3秒後に自動削除
    setTimeout(() => {
      if (feedback && feedback.parentNode) {
        feedback.remove();
      }
    }, 3000);
  } catch (feedbackError) {
    console.error('[YOUTrust Filter Popup] Failed to show feedback:', feedbackError);
  }
}

// 初期化
async function init(): Promise<void> {
  try {
    // ストレージから設定を読み込み
    const result = await chrome.storage.sync.get(['filterEnabled', 'filteredCompanies']);

    // 初回起動時はデフォルト値を設定
    if (result.filterEnabled === undefined) {
      filterEnabled = true;
      await chrome.storage.sync.set({ filterEnabled: true });
    } else {
      filterEnabled = result.filterEnabled;
    }

    if (!result.filteredCompanies) {
      filteredCompanies = DEFAULT_COMPANIES;
      await chrome.storage.sync.set({ filteredCompanies: DEFAULT_COMPANIES });
    } else {
      filteredCompanies = result.filteredCompanies;
    }

    // UIを更新
    updateUI();
  } catch (error) {
    logError(error, 'Initialization failed');
    showUserFeedback('設定の読み込みに失敗しました', 'error');
  }
}

// UIを更新
function updateUI(): void {
  try {
    // トグルスイッチの状態を設定
    filterToggle.checked = filterEnabled;

    // 企業リストを表示
    renderCompanyList();

    // フィルター件数を更新
    updateFilterCount();
  } catch (error) {
    logError(error, 'UI update failed');
    showUserFeedback('UI更新に失敗しました', 'error');
  }
}

// フィルター件数を更新
function updateFilterCount(): void {
  try {
    const count = filteredCompanies.length;
    const oldCount = parseInt(filterCount.textContent || '0') || 0;

    // カウントが変更された場合のみアニメーション
    if (oldCount !== count) {
      filterCount.style.animation = 'countUpdate 0.5s ease';
      setTimeout(() => {
        if (filterCount) filterCount.style.animation = '';
      }, 500);
    }

    filterCount.textContent = count.toString();

    // カウント値に応じて視覚的フィードバック
    filterCount.classList.remove('count-zero', 'count-few', 'count-many');
    if (count === 0) {
      filterCount.classList.add('count-zero');
    } else if (count <= 5) {
      filterCount.classList.add('count-few');
    } else {
      filterCount.classList.add('count-many');
    }

    // カウントが多い場合は警告的な視覚効果
    if (count > 10) {
      filterCount.style.fontWeight = '700';
      filterCount.style.fontSize = '14px';
    } else {
      filterCount.style.fontWeight = '600';
      filterCount.style.fontSize = '12px';
    }
  } catch (error) {
    logError(error, 'Failed to update filter count');
  }
}

// 企業リストを表示
function renderCompanyList(): void {
  try {
    companyList.innerHTML = '';

    filteredCompanies.forEach((company, index) => {
      const li = document.createElement('li');
      li.className = 'company-item';
      li.setAttribute('role', 'listitem');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'company-name';
      nameSpan.textContent = company;
      nameSpan.setAttribute('aria-label', `フィルター対象企業: ${company}`);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '削除';
      deleteBtn.setAttribute('aria-label', `${company}をフィルター対象から削除`);
      deleteBtn.onclick = (event) => removeCompany(index, event);

      li.appendChild(nameSpan);
      li.appendChild(deleteBtn);
      companyList.appendChild(li);
    });
  } catch (error) {
    logError(error, 'Failed to render company list');
    showUserFeedback('企業リストの表示に失敗しました', 'error');
  }
}

// 企業を追加
async function addCompany(): Promise<void> {
  try {
    const companyName = companyInput.value.trim();

    if (!companyName) {
      showUserFeedback('企業名を入力してください', 'info');
      return;
    }

    // 重複チェック
    if (filteredCompanies.includes(companyName)) {
      showUserFeedback('この企業は既に登録されています', 'info');
      return;
    }

    // ローディング状態を設定
    addButton.disabled = true;
    addButton.classList.add('loading');
    companyInput.disabled = true;

    // リストに追加
    filteredCompanies.push(companyName);

    // ストレージに保存
    await chrome.storage.sync.set({ filteredCompanies });

    // UIを更新
    companyInput.value = '';
    renderCompanyList();
    updateFilterCount();
    showUserFeedback(`${companyName} を追加しました`, 'success');
  } catch (error) {
    logError(error, 'Failed to add company');
    showUserFeedback('企業の追加に失敗しました', 'error');
  } finally {
    // ローディング状態を解除
    addButton.disabled = false;
    addButton.classList.remove('loading');
    companyInput.disabled = false;
  }
}

// 企業を削除
async function removeCompany(index: number, event: MouseEvent): Promise<void> {
  try {
    const removedCompany = filteredCompanies[index];

    // 削除ボタンにローディング状態を設定
    const deleteButton = event.target as HTMLButtonElement;
    const companyItem = deleteButton.closest('.company-item') as HTMLElement;

    deleteButton.disabled = true;
    deleteButton.classList.add('loading');
    companyItem.classList.add('removing');

    // アニメーション完了を待つ
    await new Promise(resolve => setTimeout(resolve, 200));

    // リストから削除
    filteredCompanies.splice(index, 1);

    // ストレージに保存
    await chrome.storage.sync.set({ filteredCompanies });

    // UIを更新
    renderCompanyList();
    updateFilterCount();
    showUserFeedback(`${removedCompany} を削除しました`, 'success');
  } catch (error) {
    logError(error, 'Failed to remove company');
    showUserFeedback('企業の削除に失敗しました', 'error');
    // エラー時はローディング状態を元に戻す
    if (event) {
      const deleteButton = event.target as HTMLButtonElement;
      const companyItem = deleteButton.closest('.company-item') as HTMLElement;
      if (deleteButton && companyItem) {
        deleteButton.disabled = false;
        deleteButton.classList.remove('loading');
        companyItem.classList.remove('removing');
      }
    }
  }
}

// フィルターのON/OFF切り替え
async function toggleFilter(): Promise<void> {
  try {
    filterEnabled = filterToggle.checked;

    // ストレージに保存
    await chrome.storage.sync.set({ filterEnabled });
    showUserFeedback(
      filterEnabled ? 'フィルターを有効にしました' : 'フィルターを無効にしました',
      'success'
    );
  } catch (error) {
    logError(error, 'Failed to toggle filter');
    showUserFeedback('フィルター切り替えに失敗しました', 'error');
    // 元の状態に戻す
    filterToggle.checked = !filterToggle.checked;
    filterEnabled = filterToggle.checked;
  }
}

// イベントリスナーを設定
filterToggle.addEventListener('change', toggleFilter);
addButton.addEventListener('click', addCompany);

// Enterキーでも追加できるようにする
companyInput.addEventListener('keypress', (e): void => {
  if (e.key === 'Enter') {
    addCompany();
  }
});

// グローバルエラーハンドラー
window.addEventListener('error', (event) => {
  logError(new Error(event.message), 'Uncaught error in popup');
  showUserFeedback('予期しないエラーが発生しました', 'error');
});

// Promise拒否のハンドリング
window.addEventListener('unhandledrejection', (event) => {
  logError(new Error(String(event.reason)), 'Unhandled promise rejection');
  showUserFeedback('処理中にエラーが発生しました', 'error');
});

// 初期化を実行
init();

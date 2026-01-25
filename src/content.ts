import {
  PerformanceMetrics,
  ErrorLogEntry,
  Selectors,
  NotificationType
} from './types';

(function(): void {
  let filterEnabled = true;
  let filteredCompanies: string[] = [];
  let processedCards = new WeakSet<Element>();
  let pendingMutations: MutationRecord[] = [];
  // let processingTimer: number | null = null; // Currently unused
  const performanceMetrics: PerformanceMetrics = {
    totalProcessed: 0,
    totalFiltered: 0,
    processingTime: [],
    lastReportTime: Date.now()
  };
  let currentFilteredCount = 0;
  let statusIndicator: HTMLDivElement | null = null;

  // エラーログ管理
  const ERROR_LOG_MAX_SIZE = 50;
  let errorLog: ErrorLogEntry[] = [];
  let errorNotificationTimeout: number | null = null;

  // デフォルトのフィルター企業
  const DEFAULT_COMPANIES = ['ラクスル株式会社'];

  // パフォーマンス設定
  // const DEBOUNCE_DELAY = 100; // Currently unused
  const THROTTLE_INTERVAL = 50;
  const METRICS_REPORT_INTERVAL = 5000;
  const ERROR_NOTIFICATION_DELAY = 3000;

  // セレクター定義（MUI Grid2対応）
  const SELECTORS: Selectors = {
    primary: {
      gridItem: '.MuiGrid2-root.MuiGrid2-grid-xs-6',
      companyName: '.MuiTypography-root.MuiTypography-caption',
      friendButton: '[data-click-component-name="friendCandidate"]'
    },
    fallback: {
      gridItem: ['div[class*="MuiGrid2-grid-xs-6"]'],
      companyName: ['span[class*="MuiTypography-caption"]']
    }
  };

  // エラーロギング関数
  function logError(error: Error | unknown, context = ''): void {
    const errorEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
      context: context,
      stack: error instanceof Error ? error.stack : '',
      url: window.location.href
    };

    errorLog.push(errorEntry);

    // ログサイズ制限
    if (errorLog.length > ERROR_LOG_MAX_SIZE) {
      errorLog = errorLog.slice(-ERROR_LOG_MAX_SIZE);
    }

    // コンソールにもエラーを出力（開発時のデバッグ用）
    console.error(`[YOUTrust Filter Error] ${context}:`, error);

    // エラーをストレージに保存（プライバシーを考慮した形で）
    try {
      chrome.storage.local.set({
        errorLog: errorLog.map(e => ({
          timestamp: e.timestamp,
          message: e.message.substring(0, 100), // メッセージを短縮
          context: e.context
        }))
      });
    } catch (storageError) {
      console.error('[YOUTrust Filter] Failed to save error log:', storageError);
    }
  }

  // ステータスインジケーターを作成
  function createStatusIndicator(): void {
    try {
      // 既存のインジケーターを削除
      if (statusIndicator && statusIndicator.parentNode) {
        statusIndicator.remove();
      }

      // インジケーターコンテナを作成
      statusIndicator = document.createElement('div');
      statusIndicator.id = 'youtrust-filter-status';
      statusIndicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        padding: 12px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 24px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        transition: all 0.3s ease;
        user-select: none;
      `;

      // アイコンとテキストを追加
      const icon = document.createElement('span');
      icon.style.cssText = `
        width: 8px;
        height: 8px;
        background: #4CAF50;
        border-radius: 50%;
        animation: pulse 2s infinite;
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
      `;

      const text = document.createElement('span');
      text.id = 'filter-status-text';
      text.textContent = 'フィルター: 準備中...';

      const count = document.createElement('span');
      count.id = 'filter-count-badge';
      count.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        padding: 2px 8px;
        border-radius: 12px;
        font-weight: 600;
        margin-left: 8px;
      `;
      count.textContent = '0件';

      statusIndicator.appendChild(icon);
      statusIndicator.appendChild(text);
      statusIndicator.appendChild(count);

      // ホバー効果
      statusIndicator.addEventListener('mouseenter', () => {
        if (statusIndicator) {
          statusIndicator.style.transform = 'scale(1.05)';
          statusIndicator.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
        }
      });

      statusIndicator.addEventListener('mouseleave', () => {
        if (statusIndicator) {
          statusIndicator.style.transform = 'scale(1)';
          statusIndicator.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }
      });

      // クリックで拡張機能のポップアップを開く指示を表示
      statusIndicator.addEventListener('click', () => {
        notifyUser('拡張機能アイコンをクリックして設定を変更してください', 'info');
      });

      document.body.appendChild(statusIndicator);

      // アニメーション用のスタイルを追加
      if (!document.getElementById('youtrust-filter-animations')) {
        const style = document.createElement('style');
        style.id = 'youtrust-filter-animations';
        style.textContent = `
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
            }
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          #youtrust-filter-status {
            animation: fadeInUp 0.5s ease-out;
          }

          .youtrust-filter-dimmed {
            opacity: 0.2;
            filter: grayscale(100%);
            pointer-events: none;
            transition: opacity 0.3s, filter 0.3s;
          }

          @media (prefers-reduced-motion: reduce) {
            #youtrust-filter-status {
              animation: none;
            }
            .youtrust-filter-dimmed {
              transition: none;
            }
          }
        `;
        document.head.appendChild(style);
      }
    } catch (error) {
      logError(error, 'Failed to create status indicator');
    }
  }

  // ステータスインジケーターを更新
  function updateStatusIndicator(): void {
    try {
      if (!statusIndicator) return;

      const icon = statusIndicator.querySelector('span:first-child') as HTMLSpanElement;
      const text = document.getElementById('filter-status-text');
      const count = document.getElementById('filter-count-badge');

      if (icon && text && count) {
        if (filterEnabled) {
          icon.style.background = '#4CAF50';
          text.textContent = `フィルター: 有効 (${filteredCompanies.length}社)`;
          count.textContent = `${currentFilteredCount}件除外`;
          count.style.display = currentFilteredCount > 0 ? 'inline' : 'none';
        } else {
          icon.style.background = '#FFA726';
          text.textContent = 'フィルター: 無効';
          count.style.display = 'none';
        }

        // カウントが変更されたときのアニメーション
        if (currentFilteredCount > 0) {
          count.style.animation = 'pulse 0.5s ease';
          setTimeout(() => {
            if (count) count.style.animation = '';
          }, 500);
        }
      }
    } catch (error) {
      logError(error, 'Failed to update status indicator');
    }
  }

  // ユーザー通知関数
  function notifyUser(message: string, type: NotificationType = 'error'): void {
    try {
      // 既存の通知を削除
      const existingNotification = document.getElementById('youtrust-filter-notification');
      if (existingNotification) {
        existingNotification.remove();
      }

      // 新しい通知を作成
      const notification = document.createElement('div');
      notification.id = 'youtrust-filter-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#f44336' : type === 'info' ? '#2196F3' : '#4CAF50'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
      `;
      notification.textContent = message;

      // アニメーション用のスタイル追加
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);

      document.body.appendChild(notification);

      // 自動的に削除
      if (errorNotificationTimeout) {
        clearTimeout(errorNotificationTimeout);
      }
      errorNotificationTimeout = setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.style.animation = 'slideOut 0.3s ease-in';
          setTimeout(() => notification.remove(), 300);
        }
      }, ERROR_NOTIFICATION_DELAY) as unknown as number;
    } catch (notificationError) {
      console.error('[YOUTrust Filter] Failed to show notification:', notificationError);
    }
  }

  // 初期化
  async function init(): Promise<void> {
    try {
      // ストレージから設定を読み込み
      const result = await chrome.storage.sync.get(['filterEnabled', 'filteredCompanies']);

      filterEnabled = result.filterEnabled !== undefined ? result.filterEnabled : true;
      filteredCompanies = result.filteredCompanies || DEFAULT_COMPANIES;

      // ステータスインジケーターを作成
      createStatusIndicator();

      // 初回フィルタリング実行
      if (filterEnabled) {
        filterCandidates();
      }

      // DOM変更の監視を開始
      observeDOM();
    } catch (error) {
      logError(error, 'Initialization failed');
      notifyUser('フィルター機能の初期化に失敗しました。ページを再読み込みしてください。', 'error');
    }
  }

  // セレクターを試行する関数 - Currently unused
  /*
  function trySelector(element: Element, selector: string | string[]): Element | null {
    if (!element || !selector) return null;

    try {
      if (typeof selector === 'string') {
        return element.querySelector(selector);
      } else if (Array.isArray(selector)) {
        for (const sel of selector) {
          try {
            const result = element.querySelector(sel);
            if (result) return result;
          } catch (selectorError) {
            // 個別のセレクターエラーは警告レベル
            console.warn(`[YOUTrust Filter] Invalid selector: ${sel}`);
          }
        }
      }
    } catch (e) {
      logError(e, `Selector error: ${selector}`);
    }
    return null;
  }
  */

  // 候補者をフィルタリングする関数（差分検出対応）
  function filterCandidates(targetElements: Element[] | null = null): void {
    try {
      const startTime = performance.now();
      let processedCount = 0;
      let filteredCount = 0;

      // ターゲット要素が指定されていない場合は全体をスキャン
      let candidateCards: Element[] = [];
      if (targetElements) {
        targetElements.forEach(element => {
          try {
            // 要素自体がグリッドアイテムでfriendButtonを持つか確認
            if (element.matches && element.matches(SELECTORS.primary.gridItem)) {
              if (element.querySelector(SELECTORS.primary.friendButton)) {
                candidateCards.push(element);
              }
            }
            // 子要素からグリッドアイテムを検索
            const childCards = element.querySelectorAll(SELECTORS.primary.gridItem);
            childCards.forEach(card => {
              if (card.querySelector(SELECTORS.primary.friendButton)) {
                candidateCards.push(card);
              }
            });
          } catch (elementError) {
            logError(elementError, 'Error processing target element');
          }
        });
      } else {
        try {
          // まずプライマリセレクターを試す（friendButtonで候補者カードをフィルタリング）
          const allGridItems = document.querySelectorAll(SELECTORS.primary.gridItem);
          candidateCards = Array.from(allGridItems).filter(item =>
            item.querySelector(SELECTORS.primary.friendButton)
          );

          // プライマリセレクターで見つからない場合のみフォールバック
          if (candidateCards.length === 0 && SELECTORS.fallback) {
            for (const selector of SELECTORS.fallback.gridItem) {
              try {
                const items = Array.from(document.querySelectorAll(selector));
                candidateCards = items.filter(item =>
                  item.querySelector(SELECTORS.primary.friendButton)
                );
                if (candidateCards.length > 0) break;
              } catch (selectorError) {
                console.warn(`[YOUTrust Filter] Fallback selector failed: ${selector}`);
              }
            }
          }
        } catch (queryError) {
          logError(queryError, 'Error querying candidate cards');
          return;
        }
      }

      candidateCards.forEach(card => {
        try {
          // WeakSetで処理済みチェック（DOM属性より高速）
          if (processedCards.has(card)) {
            return;
          }
          processedCards.add(card);
          processedCount++;

          // 企業名要素を探す（最初のcaption要素のみ = 企業名）
          const companyElement = card.querySelector(SELECTORS.primary.companyName);
          const companyName = companyElement?.textContent?.trim() || '';

          // フィルター対象企業かチェック
          if (filteredCompanies.includes(companyName)) {
            // カード自体がグリッドアイテムなので、親の検索は不要
            card.classList.add('youtrust-filter-dimmed');
            card.setAttribute('data-youtrust-filtered', 'true');
            card.setAttribute('data-filter-company', companyName);
            filteredCount++;
          }
        } catch (cardError) {
          logError(cardError, 'Error processing candidate card');
        }
      });

      // フィルター数を更新
      currentFilteredCount = document.querySelectorAll('[data-youtrust-filtered="true"]').length;
      updateStatusIndicator();

      // パフォーマンスメトリクスを更新
      const processingTime = performance.now() - startTime;
      performanceMetrics.totalProcessed += processedCount;
      performanceMetrics.totalFiltered += filteredCount;
      performanceMetrics.processingTime.push(processingTime);

      // 処理時間が長すぎる場合は警告
      if (processingTime > 100) {
        console.warn(`[YOUTrust Filter] Processing took ${processingTime.toFixed(2)}ms for ${processedCount} cards`);
      }
    } catch (error) {
      logError(error, 'Filter candidates failed');
      notifyUser('フィルタリング処理中にエラーが発生しました', 'error');
    }
  }

  // カードの表示/非表示を切り替える関数
  function toggleCards(show: boolean): void {
    try {
      // フィルターされた要素を取得
      const filteredElements = document.querySelectorAll('[data-youtrust-filtered="true"]');

      filteredElements.forEach(element => {
        try {
          const htmlElement = element as HTMLElement;
          if (show) {
            // フィルター解除：通常表示に戻す
            htmlElement.classList.remove('youtrust-filter-dimmed');
            htmlElement.removeAttribute('data-youtrust-filtered');
            htmlElement.removeAttribute('data-filter-company');
            // チェック済みフラグもクリア
            const checkedCards = htmlElement.querySelectorAll('[data-youtrust-filter-checked]');
            checkedCards.forEach(card => {
              card.removeAttribute('data-youtrust-filter-checked');
            });
          } else {
            // フィルター適用：半透明表示
            htmlElement.classList.add('youtrust-filter-dimmed');
          }
        } catch (elementError) {
          logError(elementError, 'Error toggling element visibility');
        }
      });

      // 表示に戻す場合は全体を再チェック
      if (show && filterEnabled) {
        try {
          // チェック済みフラグを全てクリアしてから再フィルタリング
          const allChecked = document.querySelectorAll('[data-youtrust-filter-checked]');
          allChecked.forEach(card => {
            card.removeAttribute('data-youtrust-filter-checked');
          });
          // WeakSetもクリア - WeakSet doesn't have clear method, create new instance
          processedCards = new WeakSet<Element>();
          filterCandidates();
        } catch (recheckError) {
          logError(recheckError, 'Error during re-filtering');
        }
      }

      // ステータスインジケーターを更新
      currentFilteredCount = document.querySelectorAll('[data-youtrust-filtered="true"]').length;
      updateStatusIndicator();
    } catch (error) {
      logError(error, 'Toggle cards failed');
      notifyUser('表示切り替え中にエラーが発生しました', 'error');
    }
  }

  // パフォーマンスメトリクスレポート
  function reportPerformanceMetrics(): void {
    if (performanceMetrics.processingTime.length === 0) return;

    const avgTime = performanceMetrics.processingTime.reduce((a, b) => a + b, 0) / performanceMetrics.processingTime.length;
    const maxTime = Math.max(...performanceMetrics.processingTime);
    const minTime = Math.min(...performanceMetrics.processingTime);

    // eslint-disable-next-line no-console
    console.log(`[YOUTrust Filter Performance Report]`);
    // eslint-disable-next-line no-console
    console.log(`  Total cards processed: ${performanceMetrics.totalProcessed}`);
    // eslint-disable-next-line no-console
    console.log(`  Total cards filtered: ${performanceMetrics.totalFiltered}`);
    // eslint-disable-next-line no-console
    console.log(`  Average processing time: ${avgTime.toFixed(2)}ms`);
    // eslint-disable-next-line no-console
    console.log(`  Min/Max processing time: ${minTime.toFixed(2)}ms / ${maxTime.toFixed(2)}ms`);
    // eslint-disable-next-line no-console
    console.log(`  Filter rate: ${((performanceMetrics.totalFiltered / performanceMetrics.totalProcessed) * 100).toFixed(1)}%`);

    // メトリクスをリセット（合計値は保持）
    performanceMetrics.processingTime = [];
    performanceMetrics.lastReportTime = Date.now();
  }

  // 定期的にパフォーマンスレポートを出力
  setInterval(reportPerformanceMetrics, METRICS_REPORT_INTERVAL);

  // デバウンス処理 - Currently unused
  /*
  function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
    let timeoutId: number;
    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay) as unknown as number;
    }) as T;
  }
  */

  // スロットリング処理
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function throttle<T extends (...args: any[]) => void>(func: T, interval: number): T {
    let lastCall = 0;
    let timeoutId: number | null = null;

    return ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      if (timeSinceLastCall >= interval) {
        lastCall = now;
        func(...args);
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          func(...args);
        }, interval - timeSinceLastCall) as unknown as number;
      }
    }) as T;
  }

  // バッチ処理でMutationを処理
  function processMutationBatch(): void {
    if (pendingMutations.length === 0) return;

    const elementsToProcess = new Set<Element>();

    // 追加された要素を収集
    pendingMutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          const element = node as Element;
          if (element.classList && (element.classList.contains('MuiGrid2-root') ||
              element.querySelector(SELECTORS.primary.gridItem))) {
            elementsToProcess.add(element);
          }
        }
      });
    });

    // バッチをクリア
    pendingMutations = [];

    // 差分検出でフィルタリング
    if (elementsToProcess.size > 0) {
      requestAnimationFrame(() => {
        filterCandidates(Array.from(elementsToProcess));
      });
    }
  }

  // スロットリングされた処理関数
  const throttledProcessMutations = throttle(processMutationBatch, THROTTLE_INTERVAL);

  // DOM変更を監視（改善版）
  function observeDOM(): void {
    try {
      const observer = new MutationObserver((mutations) => {
        try {
          if (filterEnabled) {
            // Mutationをバッチに追加
            pendingMutations.push(...mutations);

            // スロットリングで処理
            throttledProcessMutations();
          }
        } catch (mutationError) {
          logError(mutationError, 'Error handling mutations');
        }
      });

      // 監視対象を設定（オリジナルと同じ）
      const targetNode = document.getElementById('scrollableMainContentName') || document.body;
      observer.observe(targetNode, {
        childList: true,
        subtree: true
      });
    } catch (error) {
      logError(error, 'Failed to setup DOM observer');
      notifyUser('DOM監視の設定に失敗しました', 'error');
    }
  }

  // ストレージの変更を監視
  chrome.storage.onChanged.addListener((changes, namespace) => {
    try {
      if (namespace === 'sync') {
        if (changes.filterEnabled) {
          filterEnabled = changes.filterEnabled.newValue;
          toggleCards(!filterEnabled);
          updateStatusIndicator();
        }

        if (changes.filteredCompanies) {
          // 古いフィルターを解除
          toggleCards(true);

          // 新しいフィルターを適用
          filteredCompanies = changes.filteredCompanies.newValue;
          if (filterEnabled) {
            filterCandidates();
          }
          updateStatusIndicator();
        }
      }
    } catch (error) {
      logError(error, 'Storage change handler failed');
      notifyUser('設定の変更処理中にエラーが発生しました', 'error');
    }
  });

  // グローバルエラーハンドラー（未処理のエラーをキャッチ）
  window.addEventListener('error', (event) => {
    if (event.filename && event.filename.includes('content')) {
      logError(event.error || new Error(event.message), 'Uncaught error');
    }
  });

  // ページ読み込み完了後に初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

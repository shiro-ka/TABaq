import { migrateLegacyStorage, loadPositions, loadLocalBookmarks, loadWidgets } from './js/state.js';
import { loadFaviconCache } from './js/favicon.js';
import { loadBookmarks } from './js/bookmarks.js';
import { setupContextMenu } from './js/contextmenu.js';
import { setupDragAndDrop } from './js/dragdrop.js';
import { setupModals } from './js/modal.js';

// 初期化
// storage.local が非同期なので、読み込みが終わってから描画する。
// 移行は load 系より先（旧 localStorage のデータを拾い上げてから読むため）。
document.addEventListener('DOMContentLoaded', async () => {
  await migrateLegacyStorage();
  // favicon キャッシュも描画前に読む（描画時点で解決先が分かっている状態にする）
  await Promise.all([loadPositions(), loadLocalBookmarks(), loadWidgets(), loadFaviconCache()]);

  setupModals();
  setupContextMenu();
  setupDragAndDrop();
  loadBookmarks();
});

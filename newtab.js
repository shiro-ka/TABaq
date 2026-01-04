import { loadPositions, loadLocalBookmarks } from './js/state.js';
import { loadBookmarks } from './js/bookmarks.js';
import { setupContextMenu } from './js/contextmenu.js';
import { setupDragAndDrop } from './js/dragdrop.js';
import { setupModals } from './js/modal.js';

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadPositions();
  loadLocalBookmarks();
  setupModals();
  loadBookmarks();
  setupContextMenu();
  setupDragAndDrop();
});
// Need to see imports.

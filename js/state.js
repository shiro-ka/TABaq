import { DEFAULT_BOOKMARKS } from './constants.js';

// State variables
export const state = {
    currentPath: [],
    gridPositions: {},
    draggedElement: null,
    contextMenuTarget: null,
    localBookmarks: [],
    widgets: []
};

// Accessors for more complex logic if needed, but direct export is fine for this size.

// Positions Management
export function loadPositions() {
    try {
        const saved = localStorage.getItem('tabaq-grid-positions');
        if (saved) {
            state.gridPositions = JSON.parse(saved);
        }
    } catch (error) {
        console.error('位置情報の読み込みエラー:', error);
        state.gridPositions = {};
    }
}

export function savePositions() {
    try {
        localStorage.setItem('tabaq-grid-positions', JSON.stringify(state.gridPositions));
    } catch (error) {
        console.error('位置情報の保存エラー:', error);
    }
}

// Local Bookmarks Management
export function loadLocalBookmarks() {
    try {
        const saved = localStorage.getItem('tabaq-local-bookmarks');
        if (saved) {
            state.localBookmarks = JSON.parse(saved);
        } else {
            // キーが存在しない = 初回起動。ここでだけデフォルトを投入する。
            // 「保存済みだが空配列」はユーザーが全部消した状態なので、この分岐に入らず復活しない。
            state.localBookmarks = DEFAULT_BOOKMARKS.map(b => ({
                ...b,
                parentId: 'root',
                dateAdded: Date.now(),
                type: 'local'
            }));
            saveLocalBookmarks();
        }
    } catch (error) {
        console.error('ローカルブックマークの読み込みエラー:', error);
        state.localBookmarks = [];
    }
}

export function saveLocalBookmarks() {
    try {
        localStorage.setItem('tabaq-local-bookmarks', JSON.stringify(state.localBookmarks));
    } catch (error) {
        console.error('ローカルブックマークの保存エラー:', error);
    }
}

// Widgets Management
export function loadWidgets() {
    try {
        const saved = localStorage.getItem('tabaq-widgets');
        state.widgets = saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error('ウィジェットの読み込みエラー:', error);
        state.widgets = [];
    }
}

export function saveWidgets() {
    try {
        localStorage.setItem('tabaq-widgets', JSON.stringify(state.widgets));
    } catch (error) {
        console.error('ウィジェットの保存エラー:', error);
    }
}

export function getCurrentFolderId() {
    if (state.currentPath.length === 0) return 'root';
    return state.currentPath[state.currentPath.length - 1].id;
}

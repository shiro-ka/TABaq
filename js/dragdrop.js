import { state, getCurrentFolderId, savePositions } from './state.js';
import { GRID_SETTINGS } from './constants.js';
import { updateElementPosition, updateDropIndicator, removeDropIndicator, findNearestEmptyPosition } from './grid.js';

export function setupDragAndDrop() {
    const container = document.querySelector('.icons-container');

    // コンテナ全体でドロップを受け入れる
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
}

export function handleDragStart(e) {
    state.draggedElement = e.currentTarget;
    state.draggedElement.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', state.draggedElement.innerHTML);
}

export function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const container = document.querySelector('.icons-container');
    const rect = container.getBoundingClientRect();
    const relativeX = e.clientX - rect.left - GRID_SETTINGS.CONTAINER_PADDING;
    const relativeY = e.clientY - rect.top - GRID_SETTINGS.CONTAINER_PADDING;

    const col = Math.floor(relativeX / (GRID_SETTINGS.CELL_WIDTH + GRID_SETTINGS.GAP)) + 1;
    const row = Math.floor(relativeY / (GRID_SETTINGS.CELL_HEIGHT + GRID_SETTINGS.GAP)) + 1;

    if (col < 1 || row < 1) return false;

    updateDropIndicator(row, col);

    return false;
}

export function handleDragEnter(e) {
    const target = e.currentTarget;
    if (target !== state.draggedElement && target.classList.contains('icon-item')) {
        target.classList.add('drag-over');
    }
}

export function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

export function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    e.preventDefault();
    removeDropIndicator();

    // ドロップ先のスタイルクリア
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });

    if (!state.draggedElement) return false;

    const container = document.querySelector('.icons-container');
    const rect = container.getBoundingClientRect();

    // グリッド座標を計算
    const relativeX = e.clientX - rect.left - GRID_SETTINGS.CONTAINER_PADDING;
    const relativeY = e.clientY - rect.top - GRID_SETTINGS.CONTAINER_PADDING;

    const col = Math.floor(relativeX / (GRID_SETTINGS.CELL_WIDTH + GRID_SETTINGS.GAP)) + 1;
    const row = Math.floor(relativeY / (GRID_SETTINGS.CELL_HEIGHT + GRID_SETTINGS.GAP)) + 1;

    // 範囲外チェック (最小値)
    if (col < 1 || row < 1) return false;

    const folderId = getCurrentFolderId();
    if (!state.gridPositions[folderId]) state.gridPositions[folderId] = {};

    const draggedId = state.draggedElement.dataset.id;

    // 移動先の位置にあるアイテムを探す
    let targetId = null;
    const positions = state.gridPositions[folderId];

    for (const [id, pos] of Object.entries(positions)) {
        if (pos.row === row && pos.col === col && id !== draggedId) {
            targetId = id;
            break;
        }
    }

    // 移動・交換処理
    if (targetId) {
        // 交換ターゲットがある場合
        // ターゲットをどこかにどかす
        // どかす先: 最寄りの空き場所 (ただし draggedId の元いた場所も考慮に入れるか？)
        // ユーザー要望: "入れ替わるのではなく、最寄りの空いているマスに移動"
        // 典型的なのは、draggedId の元いた場所へ行く（スワップ）だが、それ以外にしたいなら
        // findNearestEmptyPosition で excludePos に draggedId の元位置を含める。

        // 元の位置
        const draggedPos = positions[draggedId];

        // draggedId の元位置を除外して探す
        const newTargetPos = findNearestEmptyPosition(folderId, row, col, draggedPos);

        // 1. targetId を新しい場所へ移動
        state.gridPositions[folderId][targetId] = newTargetPos;
        const targetElement = document.querySelector(`.icon-item[data-id="${targetId}"]`);
        if (targetElement) {
            updateElementPosition(targetElement, newTargetPos);
        }

        // 2. draggedId をターゲットの位置へ移動
        state.gridPositions[folderId][draggedId] = { row, col };
        updateElementPosition(state.draggedElement, { row, col });

    } else {
        // 空いている場所への移動
        state.gridPositions[folderId][draggedId] = { row, col };
        updateElementPosition(state.draggedElement, { row, col });
    }

    savePositions();

    return false;
}

export function handleDragEnd(e) {
    if (state.draggedElement) {
        state.draggedElement.classList.remove('dragging');
    }

    removeDropIndicator();

    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });

    state.draggedElement = null;
}

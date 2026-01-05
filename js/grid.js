import { GRID_SETTINGS } from './constants.js';
import { state } from './state.js';

function getVisibleGridDimensions() {
    const padding = GRID_SETTINGS.CONTAINER_PADDING * 2;
    const colWidth = GRID_SETTINGS.CELL_WIDTH + GRID_SETTINGS.GAP;
    const rowHeight = GRID_SETTINGS.CELL_HEIGHT + GRID_SETTINGS.GAP;

    const cols = Math.floor((window.innerWidth - padding) / colWidth);
    const rows = Math.floor((window.innerHeight - padding) / rowHeight);

    return {
        cols: Math.max(1, cols),
        rows: Math.max(1, rows)
    };
}

export function findEmptyPosition(folderId) {
    const occupied = new Set();
    const positions = state.gridPositions[folderId] || {};

    // 既に使用されている位置を記録
    Object.values(positions).forEach(pos => {
        occupied.add(`${pos.row},${pos.col}`);
    });

    const visible = getVisibleGridDimensions();

    // 1. まず現在の表示領域内で空いている位置を探す
    for (let row = 1; row <= visible.rows; row++) {
        for (let col = 1; col <= visible.cols; col++) {
            const key = `${row},${col}`;
            if (!occupied.has(key)) {
                return { row, col };
            }
        }
    }

    // 2. 表示領域がいっぱいなら、仮想キャンバス（最大20列）まで広げて探す
    for (let row = 1; row <= 20; row++) {
        for (let col = 1; col <= 20; col++) {
            const key = `${row},${col}`;
            if (!occupied.has(key)) {
                return { row, col };
            }
        }
    }

    // 見つからない場合は適当な位置（通常はありえない）
    return { row: 20, col: 20 };
}

export function findNearestEmptyPosition(folderId, centerRow, centerCol, excludePos = null) {
    const occupied = new Set();
    const positions = state.gridPositions[folderId] || {};

    Object.values(positions).forEach(pos => occupied.add(`${pos.row},${pos.col}`));
    if (excludePos) occupied.add(`${excludePos.row},${excludePos.col}`);
    occupied.add(`${centerRow},${centerCol}`);

    // マンハッタン距離順に探索
    for (let d = 1; d < 20; d++) {
        const candidates = [];

        for (let dx = 0; dx <= d; dx++) {
            const dy = d - dx;

            const offsets = new Set();
            offsets.add(`${dx},${dy}`);
            offsets.add(`${dx},${-dy}`);
            offsets.add(`${-dx},${dy}`);
            offsets.add(`${-dx},${-dy}`);

            offsets.forEach(offset => {
                const [ox, oy] = offset.split(',').map(Number);
                candidates.push({ row: centerRow + oy, col: centerCol + ox });
            });
        }

        // 優先順位: 右 > 下 > その他
        // 右下も含めて右・下方向を優先する
        candidates.sort((a, b) => {
            const getWeight = (pos) => {
                const dr = pos.row - centerRow;
                const dc = pos.col - centerCol;

                // 真右
                if (dc > 0 && dr === 0) return 1;
                // 真下
                if (dr > 0 && dc === 0) return 2;
                // 右下
                if (dc > 0 && dr > 0) return 3;

                // それ以外（左、上、左下、右上、左上など）
                return 10;
            };

            const wa = getWeight(a);
            const wb = getWeight(b);

            if (wa !== wb) return wa - wb;

            // 同じ重みなら、通常のオーダー（行優先）
            if (a.row !== b.row) return a.row - b.row;
            return a.col - b.col;
        });

        for (const cand of candidates) {
            if (cand.row < 1 || cand.col < 1) continue;
            if (!occupied.has(`${cand.row},${cand.col}`)) {
                return cand;
            }
        }
    }

    return findEmptyPosition(folderId);
}

export function updateElementPosition(element, pos) {
    element.style.gridRow = pos.row;
    element.style.gridColumn = pos.col;
    element.dataset.gridPos = `${pos.row},${pos.col}`;
}

export function updateDropIndicator(row, col) {
    let indicator = document.querySelector('.drop-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        document.querySelector('.icons-container').appendChild(indicator);
    }

    indicator.style.gridRow = row;
    indicator.style.gridColumn = col;
}

export function removeDropIndicator() {
    const indicator = document.querySelector('.drop-indicator');
    if (indicator) {
        indicator.remove();
    }
}

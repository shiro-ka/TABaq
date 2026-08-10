import { state, saveLocalBookmarks, savePositions, saveWidgets } from './state.js';
import { reloadCurrentFolder } from './bookmarks.js';
import { alertDialog, confirmDialog } from './dialog.js';

// 現在のローカルデータ(ブックマーク + アイコン配置)を JSON ファイルとして書き出す。
// localStorage しか無い構成なので、プロファイル消失に備えた手動バックアップ手段。
export function exportBackup() {
    const data = {
        app: 'TABaq',
        version: 1,
        exportedAt: new Date().toISOString(),
        localBookmarks: state.localBookmarks,
        gridPositions: state.gridPositions,
        widgets: state.widgets
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabaq-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// JSON バックアップを読み込んで、現在のデータを置き換える。
export function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const data = JSON.parse(reader.result);
                if (data.app !== 'TABaq' || !Array.isArray(data.localBookmarks)) {
                    await alertDialog({ title: '復元できません', message: 'TABaq のバックアップファイルではないようです' });
                    return;
                }
                const ok = await confirmDialog({
                    title: 'バックアップから復元',
                    message: '現在の TABaq のデータをこのバックアップで置き換えます。よろしいですか？',
                    okText: '復元',
                    danger: true
                });
                if (!ok) return;

                state.localBookmarks = data.localBookmarks;
                state.gridPositions = data.gridPositions || {};
                state.widgets = data.widgets || [];
                saveLocalBookmarks();
                savePositions();
                saveWidgets();

                // ルートに戻して再描画
                state.currentPath = [];
                reloadCurrentFolder();
                await alertDialog({ title: '復元しました', message: 'バックアップからデータを復元しました' });
            } catch (e) {
                console.error('バックアップ読み込みエラー:', e);
                await alertDialog({ title: '復元に失敗しました', message: 'バックアップの読み込みに失敗しました' });
            }
        };
        reader.readAsText(file);
    });

    input.click();
}

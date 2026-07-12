// 汎用のプロンプト/確認ダイアログ。
// 既存の .modal-overlay / .modal のスタイルと開閉アニメをそのまま再利用する。

function buildOverlay(innerHTML) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay hidden';
    overlay.innerHTML = `<div class="modal">${innerHTML}</div>`;
    document.body.appendChild(overlay);
    // reflow を強制して hidden 状態を確定させてから外す → 開くアニメが走る
    void overlay.offsetHeight;
    overlay.classList.remove('hidden');
    return overlay;
}

function closeOverlay(overlay) {
    overlay.classList.add('hidden');
    // フェード(0.2s)を待ってから DOM から除去
    setTimeout(() => overlay.remove(), 250);
}

// テキスト入力ダイアログ。OK で入力文字列、キャンセル/Escape で null を返す。
export function promptDialog({ title = '入力', label = '', value = '', placeholder = '', okText = 'OK' } = {}) {
    return new Promise(resolve => {
        const overlay = buildOverlay(`
            <div class="modal-header"><h3></h3></div>
            <div class="modal-body">
                <div class="form-group">
                    <label></label>
                    <input type="text">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" data-role="cancel">キャンセル</button>
                <button class="btn-primary" data-role="ok"></button>
            </div>
        `);

        // 値は textContent / value で入れて HTML 混入を避ける
        overlay.querySelector('.modal-header h3').textContent = title;
        overlay.querySelector('.form-group label').textContent = label;
        const okBtn = overlay.querySelector('[data-role="ok"]');
        okBtn.textContent = okText;
        const input = overlay.querySelector('input');
        input.value = value;
        input.placeholder = placeholder;

        function finish(result) {
            document.removeEventListener('keydown', onKey);
            closeOverlay(overlay);
            resolve(result);
        }
        function submit() {
            const v = input.value.trim();
            finish(v ? v : null);
        }
        function onKey(e) {
            if (e.key === 'Escape') finish(null);
            if (e.key === 'Enter') submit();
        }

        overlay.querySelector('[data-role="cancel"]').addEventListener('click', () => finish(null));
        okBtn.addEventListener('click', submit);
        overlay.addEventListener('click', e => { if (e.target === overlay) finish(null); });
        document.addEventListener('keydown', onKey);

        input.focus();
        input.select();
    });
}

// 確認ダイアログ。OK/Enter で true、キャンセル/Escape/外側クリックで false を返す。
export function confirmDialog({ title = '確認', message = '', okText = 'OK', danger = false } = {}) {
    return new Promise(resolve => {
        const overlay = buildOverlay(`
            <div class="modal-header"><h3></h3></div>
            <div class="modal-body"><p class="dialog-message"></p></div>
            <div class="modal-footer">
                <button class="btn-secondary" data-role="cancel">キャンセル</button>
                <button class="btn-primary" data-role="ok"></button>
            </div>
        `);

        overlay.querySelector('.modal-header h3').textContent = title;
        overlay.querySelector('.dialog-message').textContent = message;
        const okBtn = overlay.querySelector('[data-role="ok"]');
        okBtn.textContent = okText;
        if (danger) okBtn.classList.add('btn-danger');

        function finish(result) {
            document.removeEventListener('keydown', onKey);
            closeOverlay(overlay);
            resolve(result);
        }
        function onKey(e) {
            if (e.key === 'Escape') finish(false);
            if (e.key === 'Enter') finish(true);
        }

        overlay.querySelector('[data-role="cancel"]').addEventListener('click', () => finish(false));
        okBtn.addEventListener('click', () => finish(true));
        overlay.addEventListener('click', e => { if (e.target === overlay) finish(false); });
        document.addEventListener('keydown', onKey);

        okBtn.focus();
    });
}

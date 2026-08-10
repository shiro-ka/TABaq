// 汎用のプロンプト/確認ダイアログ。
// 既存の .modal-overlay / .modal のスタイルと開閉アニメをそのまま再利用する。

// ヘッダー/本文/フッターの骨組みを DOM で組み立てて表示する。
// HTML 文字列を経由しないので、title やラベルに何が来ても markup として解釈されない。
// showCancel=false にすると OK だけの通知ダイアログになる。
function buildDialog({ title, body, okText, danger = false, showCancel = true }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay hidden';

    const modal = document.createElement('div');
    modal.className = 'modal';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const heading = document.createElement('h3');
    heading.textContent = title;
    header.appendChild(heading);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'modal-body';
    bodyEl.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'キャンセル';
    const okBtn = document.createElement('button');
    okBtn.className = danger ? 'btn-primary btn-danger' : 'btn-primary';
    okBtn.textContent = okText;
    if (showCancel) footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);

    modal.append(header, bodyEl, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // reflow を強制して hidden 状態を確定させてから外す → 開くアニメが走る
    void overlay.offsetHeight;
    overlay.classList.remove('hidden');

    return { overlay, okBtn, cancelBtn };
}

function closeOverlay(overlay) {
    overlay.classList.add('hidden');
    // フェード(0.2s)を待ってから DOM から除去
    setTimeout(() => overlay.remove(), 250);
}

// テキスト入力ダイアログ。OK で入力文字列、キャンセル/Escape で null を返す。
export function promptDialog({ title = '入力', label = '', value = '', placeholder = '', okText = 'OK' } = {}) {
    return new Promise(resolve => {
        const group = document.createElement('div');
        group.className = 'form-group';

        const labelEl = document.createElement('label');
        labelEl.textContent = label;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.placeholder = placeholder;

        group.append(labelEl, input);

        const { overlay, okBtn, cancelBtn } = buildDialog({ title, body: group, okText });

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

        cancelBtn.addEventListener('click', () => finish(null));
        okBtn.addEventListener('click', submit);
        overlay.addEventListener('click', e => { if (e.target === overlay) finish(null); });
        document.addEventListener('keydown', onKey);

        input.focus();
        input.select();
    });
}

// 通知ダイアログ。ネイティブの alert() の置き換え。閉じたら解決する。
export function alertDialog({ title = 'お知らせ', message = '', okText = 'OK' } = {}) {
    return new Promise(resolve => {
        const messageEl = document.createElement('p');
        messageEl.className = 'dialog-message';
        messageEl.textContent = message;

        const { overlay, okBtn } = buildDialog({ title, body: messageEl, okText, showCancel: false });

        function finish() {
            document.removeEventListener('keydown', onKey);
            closeOverlay(overlay);
            resolve();
        }
        function onKey(e) {
            if (e.key === 'Escape' || e.key === 'Enter') finish();
        }

        okBtn.addEventListener('click', finish);
        overlay.addEventListener('click', e => { if (e.target === overlay) finish(); });
        document.addEventListener('keydown', onKey);

        okBtn.focus();
    });
}

// 確認ダイアログ。OK/Enter で true、キャンセル/Escape/外側クリックで false を返す。
export function confirmDialog({ title = '確認', message = '', okText = 'OK', danger = false } = {}) {
    return new Promise(resolve => {
        const messageEl = document.createElement('p');
        messageEl.className = 'dialog-message';
        messageEl.textContent = message;

        const { overlay, okBtn, cancelBtn } = buildDialog({ title, body: messageEl, okText, danger });

        function finish(result) {
            document.removeEventListener('keydown', onKey);
            closeOverlay(overlay);
            resolve(result);
        }
        function onKey(e) {
            if (e.key === 'Escape') finish(false);
            if (e.key === 'Enter') finish(true);
        }

        cancelBtn.addEventListener('click', () => finish(false));
        okBtn.addEventListener('click', () => finish(true));
        overlay.addEventListener('click', e => { if (e.target === overlay) finish(false); });
        document.addEventListener('keydown', onKey);

        okBtn.focus();
    });
}

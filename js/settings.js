import { el, button, overlay, toast } from './ui.js';
import { store, save, WALLS, setWallpaper } from './store.js';
import { folders, folderLabel, saveFolder } from './marks.js';
import { render } from './bus.js';

export function applyLook() {
    const root = document.documentElement;
    const wall = WALLS.find(w => w.key === store.settings.wall);
    const image = store.settings.wall === 'image' && store.wallpaper;
    root.style.setProperty('--wall', image ? `url("${store.wallpaper}")` : (wall || WALLS[0]).color);
    document.body.classList.toggle('light', !image && !!wall?.light);
    document.body.classList.toggle('image', !!image);
    const font = store.settings.font.trim();
    if (font) root.style.setProperty('--font', `"${font.replace(/"/g, '')}", sans-serif`);
    else root.style.removeProperty('--font');
}

export function fontAvailable(name) {
    const probe = 'abcdefghijklmnopqrstuvwxyz0123456789あいうえお漢字';
    const c = document.createElement('canvas').getContext('2d');
    const width = family => { c.font = `32px ${family}`; return c.measureText(probe).width; };
    const safe = `"${name.replace(/"/g, '')}"`;
    return ['monospace', 'serif', 'sans-serif'].some(base => width(`${safe}, ${base}`) !== width(base));
}

function readImage(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
    });
}

export async function openSettings() {
    const s = store.settings;
    const box = el('div', 'dialog');
    box.setAttribute('role', 'dialog');
    box.append(el('h2', null, '設定'));

    const multi = el('label', 'check', '複数のデスクトップを使う');
    const multiBox = el('input');
    multiBox.type = 'checkbox';
    multiBox.checked = s.multi;
    multi.append(multiBox);
    multiBox.addEventListener('change', () => {
        s.multi = multiBox.checked;
        if (s.multi && store.layout.desktops.length < 2) store.layout.desktops.push({ items: [] });
        if (!s.multi) store.page = 0;
        save(); render();
        toast(s.multi ? '下の点でデスクトップを切り替えられます。横スクロールや ← → でもめくれます' : '1枚目のデスクトップだけを出します（ほかのデスクトップは残っています）');
    });

    const saveField = el('label', 'field', 'TABaq で作ったブックマークの既定の保存先');
    const saveSel = el('select');
    const current = await saveFolder(s.saveTo);
    if (s.saveTo !== current) { s.saveTo = current; save(); }
    for (const f of folders().map(f => ({ id: f.id, label: folderLabel(f.id) })).sort((a, b) => a.label.localeCompare(b.label, 'ja'))) {
        const o = el('option', null, f.label);
        o.value = f.id;
        if (f.id === current) o.selected = true;
        saveSel.append(o);
    }
    saveSel.addEventListener('change', () => { s.saveTo = saveSel.value; save(); });
    saveField.append(saveSel);

    const wallField = el('div', 'field', '壁紙');
    const swatches = el('div', 'swatches');
    const mark = () => swatches.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.key === s.wall)));
    for (const w of WALLS) {
        const b = button('swatch');
        b.dataset.key = w.key;
        b.style.background = w.color;
        b.setAttribute('aria-label', w.key);
        b.addEventListener('click', () => { s.wall = w.key; save(); applyLook(); mark(); });
        swatches.append(b);
    }
    const file = el('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.hidden = true;
    const pick = button('swatch swatch-pick', '画像を選ぶ', () => file.click());
    pick.dataset.key = 'image';
    file.addEventListener('change', async () => {
        const f = file.files[0];
        if (!f) return;
        try {
            await setWallpaper(await readImage(f));
            s.wall = 'image';
            save(); applyLook(); mark();
        } catch {
            toast('画像を読み込めませんでした');
        }
    });
    swatches.append(pick, file);
    wallField.append(swatches);
    mark();

    const fontField = el('label', 'field', 'フォント（空ならブラウザの既定）');
    const fontInput = el('input');
    fontInput.type = 'text';
    fontInput.value = s.font;
    fontInput.placeholder = 'パソコンに入っているフォントの名前';
    const fontNote = el('small');
    const checkFont = () => {
        const v = fontInput.value.trim();
        fontNote.textContent = !v ? '' : fontAvailable(v) ? `「${v}」で表示しています` : `「${v}」は見つかりません。ブラウザの既定のフォントで表示しています`;
    };
    let fontTimer;
    fontInput.addEventListener('input', () => {
        clearTimeout(fontTimer);
        fontTimer = setTimeout(() => { s.font = fontInput.value.trim(); save(); applyLook(); checkFont(); }, 300);
    });
    fontField.append(fontInput, fontNote);
    checkFont();

    const act = el('div', 'actions');
    const o = overlay(box);
    act.append(button('btn primary', '閉じる', () => o.remove()));
    box.append(multi, saveField, wallField, fontField, act);
    multiBox.focus();
}

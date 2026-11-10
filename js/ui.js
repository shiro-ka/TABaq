export function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
}

export function button(cls, text, onClick) {
    const b = el('button', cls, text);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
}

let toastTimer;
export function toast(msg) {
    document.querySelector('.toast')?.remove();
    const t = el('div', 'toast', msg);
    t.setAttribute('role', 'status');
    document.body.append(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2800);
}

export function closeMenu() { document.querySelector('.menu')?.remove(); }

export function menu(x, y, entries) {
    closeMenu();
    const m = el('div', 'menu');
    m.setAttribute('role', 'menu');
    for (const e of entries) {
        if (e === '-') { m.append(el('hr')); continue; }
        if (e.head) { m.append(el('div', 'menu-head', e.head)); continue; }
        const b = button('menu-item' + (e.danger ? ' danger' : ''), e.label, () => { closeMenu(); e.run(); });
        b.setAttribute('role', 'menuitem');
        m.append(b);
    }
    document.body.append(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    m.querySelector('.menu-item')?.focus();
}

addEventListener('pointerdown', e => { if (!e.target.closest('.menu')) closeMenu(); });
addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('.menu')) { closeMenu(); return; }
    const o = [...document.querySelectorAll('.overlay')].pop();
    if (o) { o.remove(); return; }
    document.querySelector('.drawer')?.classList.remove('open');
});

export function overlay(content) {
    const o = el('div', 'overlay');
    o.addEventListener('pointerdown', e => { if (e.target === o) o.remove(); });
    o.append(content);
    document.body.append(o);
    return o;
}

export function closeOverlays() { document.querySelectorAll('.overlay').forEach(o => o.remove()); }

export function confirmBox({ title, message, ok, danger }) {
    return new Promise(resolve => {
        const box = el('div', 'dialog');
        box.setAttribute('role', 'dialog');
        box.append(el('h2', null, title));
        if (message) box.append(el('p', null, message));
        const act = el('div', 'actions');
        const o = overlay(box);
        const done = v => { o.remove(); resolve(v); };
        const no = button('btn', 'やめる', () => done(false));
        act.append(no, button('btn ' + (danger ? 'warn' : 'primary'), ok, () => done(true)));
        box.append(act);
        no.focus();
    });
}

export function formBox({ title, fields, ok }) {
    return new Promise(resolve => {
        const box = el('form', 'dialog');
        box.setAttribute('role', 'dialog');
        box.append(el('h2', null, title));
        const inputs = {};
        for (const f of fields) {
            const label = el('label', 'field', f.label);
            let input;
            if (f.options) {
                input = el('select');
                for (const opt of f.options) {
                    const o = el('option', null, opt.label);
                    o.value = opt.value;
                    if (opt.value === f.value) o.selected = true;
                    input.append(o);
                }
            } else {
                input = el('input');
                input.type = 'text';
                input.value = f.value || '';
                if (f.placeholder) input.placeholder = f.placeholder;
            }
            input.name = f.name;
            label.append(input);
            if (f.note) label.append(el('small', null, f.note));
            inputs[f.name] = input;
            box.append(label);
        }
        const act = el('div', 'actions');
        const o = overlay(box);
        act.append(button('btn', 'やめる', () => { o.remove(); resolve(null); }));
        const go = el('button', 'btn primary', ok);
        go.type = 'submit';
        act.append(go);
        box.append(act);
        box.addEventListener('submit', e => {
            e.preventDefault();
            const out = {};
            for (const [k, v] of Object.entries(inputs)) out[k] = v.value.trim();
            o.remove();
            resolve(out);
        });
        (Object.values(inputs).find(i => !i.value) || Object.values(inputs)[0])?.focus();
    });
}

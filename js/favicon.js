import { createIcon } from './utils.js';

// favicon の解決結果キャッシュ。
// 毎回「サイト自身の /favicon.ico を試す → 失敗を待つ → DuckDuckGo」と辿ると、
// その失敗分がそのままタブを開くたびのラグになる。
// 前回どれで成功したか(あるいは全滅したか)を覚えておき、次回はそこへ直行する。
const CACHE_KEY = 'tabaq-favicon-cache';

// 解決結果の有効期間。過ぎたら試し直す。
// (後から favicon を置いたサイトを永久に諦めてしまわないため)
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// hostname -> { url: 成功したURL | null(全滅), ts: 記録時刻 }
let cache = {};
let saveTimer = null;

export async function loadFaviconCache() {
    try {
        const got = await browser.storage.local.get(CACHE_KEY);
        cache = got[CACHE_KEY] || {};
    } catch (error) {
        console.error('faviconキャッシュの読み込みエラー:', error);
        cache = {};
    }
}

// 一画面ぶんのアイコンが一斉に解決されるので、まとめて1回だけ書き込む。
function schedulePersist() {
    if (saveTimer) return;
    saveTimer = setTimeout(async () => {
        saveTimer = null;
        try {
            await browser.storage.local.set({ [CACHE_KEY]: cache });
        } catch (error) {
            console.error('faviconキャッシュの保存エラー:', error);
        }
    }, 1000);
}

function remember(hostname, url) {
    const prev = cache[hostname];
    // 前回と同じ結果で、まだ有効期間内なら書き直さない
    if (prev && prev.url === url && Date.now() - prev.ts < MAX_AGE) return;
    cache[hostname] = { url, ts: Date.now() };
    schedulePersist();
}

// 取得候補を優先順で返す。
// 1. サイト自身の /favicon.ico … 第三者に一切送らない(最優先)
// 2. DuckDuckGo … サイト自身で取れない時だけ叩くフォールバック(Google より穏当な第三者)
function getCandidates(url) {
    try {
        const u = new URL(url);
        return {
            hostname: u.hostname,
            candidates: [
                `${u.origin}/favicon.ico`,
                `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`
            ]
        };
    } catch {
        return { hostname: null, candidates: [] };
    }
}

// iconImage の中に favicon(またはフォールバックのSVG)を差し込む。
export function renderFavicon(iconImage, url) {
    const { hostname, candidates } = getCandidates(url);
    if (!hostname || candidates.length === 0) {
        iconImage.appendChild(createIcon('bookmark'));
        return;
    }

    const entry = cache[hostname];
    const fresh = entry && (Date.now() - entry.ts) < MAX_AGE;

    // 前回どれも駄目だったと分かっているなら、通信せずに即SVG
    if (fresh && entry.url === null) {
        iconImage.appendChild(createIcon('bookmark'));
        return;
    }

    // 前回成功したURLがあるならそこから始める(失敗する候補を踏まない)
    const order = fresh && entry.url
        ? [entry.url, ...candidates.filter(c => c !== entry.url)]
        : candidates;

    const img = document.createElement('img');
    img.alt = '';
    let idx = 0;
    img.src = order[idx];

    img.onload = () => remember(hostname, order[idx]);
    img.onerror = () => {
        idx++;
        if (idx < order.length) {
            img.src = order[idx]; // 次の候補へ
        } else {
            remember(hostname, null); // 全滅を記録 → 次回から通信しない
            img.remove();
            iconImage.appendChild(createIcon('bookmark'));
        }
    };

    iconImage.appendChild(img);
}

// favicon の取得候補を優先順で返す。
// 1. サイト自身の /favicon.ico … 第三者に一切送らない（最優先）
// 2. DuckDuckGo … サイト自身で取れない時だけ叩くフォールバック（Google より穏当な第三者）
// どれも失敗したら bookmarks.js 側で SVG アイコンに落とす。
export function getFaviconCandidates(url) {
    try {
        const urlObj = new URL(url);
        return [
            `${urlObj.origin}/favicon.ico`,
            `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`
        ];
    } catch {
        return [];
    }
}

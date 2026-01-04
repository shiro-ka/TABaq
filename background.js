// TABaq - Background Script
// 拡張機能アイコンクリック時に新しいタブでブックマークページを開く

browser.browserAction.onClicked.addListener(() => {
    browser.tabs.create({
        url: browser.runtime.getURL("newtab.html")
    });
});

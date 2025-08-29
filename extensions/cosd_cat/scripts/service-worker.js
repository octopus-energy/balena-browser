const tabErrors = {};

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request == "errorDetails") {
        sendResponse(tabErrors[sender.tab.id]);
    }
});

chrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, {
    urls: ["http://*/*", "https://*/*"],
});

async function onErrorOccurred(details) {
    if (
        !details.parentDocumentId &&
        !details.documentId &&
        details.documentLifecycle == "active" &&
        details.error != "net::ERR_ABORTED"
    ) {
        tabErrors[details.tabId] = details;
        await chrome.tabs.update(details.tabId, { url: "error/index.html" });
    }
}

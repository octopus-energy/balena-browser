const tabErrors = {};
let config;

fetch(chrome.runtime.getURL("config.json")).then((resp) => {
    resp.json().then((jsonConfig) => {
        config = jsonConfig;
    });
}).catch((e) => {console.log(e)});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.type == "errorDetails") {
        sendResponse(tabErrors[sender.tab.id]);
    } else if (request.type == "updateLocation") {
        chrome.tabs.update(sender.tab.id, { url: request.url });
    }
});

chrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, {
    urls: ["<all_urls>"],
});

chrome.webRequest.onResponseStarted.addListener(onResponseStarted, {
    urls: ["<all_urls>"],
});

async function onResponseStarted(details) {
    if (
        details.statusCode > 399 &&
        details.type == "main_frame" &&
        details.url.toLowerCase().includes(config.upstreamUrl)

    ) {
        tabErrors[details.tabId] = details;
        await chrome.tabs.update(details.tabId, { url: "pages/error/index.html" });
    }
}

async function onErrorOccurred(details) {
    if (
        !details.parentDocumentId &&
        !details.documentId &&
        details.documentLifecycle == "active" &&
        details.error != "net::ERR_ABORTED"
    ) {
        tabErrors[details.tabId] = details;
        await chrome.tabs.update(details.tabId, { url: "pages/error/index.html" });
    }
}

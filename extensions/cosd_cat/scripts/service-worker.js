const tabErrors = {};

const configPromise = fetch(chrome.runtime.getURL("config.json"))
    .then((response) => {
        if (!response.ok) {
            throw new Error(
                `Failed to fetch config.json: ${response.statusText}`
            );
        }
        return response.json();
    })
    .catch((error) => {
        console.error("Failed to fetch config.json:", error);
        return null;
    });

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

chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, {
    urls: ["<all_urls>"],
    types: ["main_frame"],
});

async function onHeadersReceived(details) {
    const config = await configPromise;
    if (
        details.statusCode > 399 &&
        details.url.toLowerCase().includes(config.upstreamUrl)
    ) {
        tabErrors[details.tabId] = details;
        await chrome.tabs.update(details.tabId, {
            url: "pages/error/index.html",
        });
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
        await chrome.tabs.update(details.tabId, {
            url: "pages/error/index.html",
        });
    }
}

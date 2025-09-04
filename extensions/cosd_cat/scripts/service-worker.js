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

const wantedResourceTypes = [
    "main_frame",
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "ping",
    "csp_report",
    "media",
    "websocket",
    "webtransport",
    "webbundle",
    "other",
];

(async () => {
    let config = await configPromise;

    if (config.addHeaders) {
        const headerRules = [];

        for (let i = 0; i < config.addHeaders.length; i++) {
            let addHeader = config.addHeaders[i];
            headerRules.push({
                id: i + 1,
                priority: 1,
                action: {
                    type: "modifyHeaders",
                    requestHeaders: [
                        {
                            header: addHeader.authHeaderKey,
                            operation: "set",
                            value: addHeader.authHeaderValue,
                        },
                    ],
                },
                condition: {
                    urlFilter: addHeader.upstreamUrl,
                    resourceTypes: wantedResourceTypes,
                },
            });
        }

        chrome.declarativeNetRequest.getSessionRules().then((rules) => {
            chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: rules.map((rule) => rule.id),
                addRules: headerRules,
            });
        });
    }
})();

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
        (details.url.toLowerCase().includes(config.upstreamUrl) ||
            details.url.toLowerCase().includes("proxy:8080"))
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

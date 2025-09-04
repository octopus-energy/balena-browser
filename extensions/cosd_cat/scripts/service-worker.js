const tabErrors = {};
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

async function setDeclarativeNetworkRequest() {
    chrome.storage.local.get().then((result) => {
        if (!result.launchUrls) {
            console.log("launchUrls not set yet, waiting and trying again.")
            return;
        } else if (!result.upstreamUrl) {
            console.log("upstreamUrl not set, not proxying.")
            clearInterval(intervalId)
            return;
        }

        if (result.upstreamUrl && result.authHeaderKey && result.authHeaderValue) {
            let headerRule = {
                id: 1,
                priority: 1,
                action: {
                    type: "modifyHeaders",
                    requestHeaders: [
                        {
                            header: result.authHeaderKey,
                            operation: "set",
                            value: result.authHeaderValue,
                        },
                    ],
                },
                condition: {
                    urlFilter: result.upstreamUrl,
                    resourceTypes: wantedResourceTypes,
                },
            };
            chrome.declarativeNetRequest.getSessionRules().then((rules) => {
                chrome.declarativeNetRequest.updateSessionRules({
                    removeRuleIds: rules.map((rule) => rule.id),
                    addRules: [headerRule],
                });
            });
        }
        clearInterval(intervalId);
    });
}

let intervalId = setInterval(setDeclarativeNetworkRequest, 1000)
setDeclarativeNetworkRequest();

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
        !details.documentUrl &&
        details.documentLifecycle == "active" &&
        details.error != "net::ERR_ABORTED"
    ) {
        tabErrors[details.tabId] = details;
        await chrome.tabs.update(details.tabId, { url: "error/index.html" });
    }
}

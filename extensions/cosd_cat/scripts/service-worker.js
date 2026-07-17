importScripts("logger.js", "credential-utils.js");

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
        log("ERROR", "Failed to fetch config.json:", error);
        return null;
    });

function convertS3Url(url) {
    if (url.startsWith("s3://")) {
        const s3Path = url.substring(5); // Remove "s3://"
        const [bucket, ...keyParts] = s3Path.split("/");
        const key = keyParts.join("/");
        return `https://${bucket}.s3.amazonaws.com/${key}`;
    }
    return url;
}

/**
 * Resolve credentials for a given URL
 * 1. If content has a credential, use that
 * 2. Otherwise, look up sharedCredentials by exact hostname
 */
function resolveCredentials(url, contentCredential, sharedCredentials) {
    try {
        const { credentials, warning } =
            CredentialUtils.resolveCredentialsForUrl(
                url,
                contentCredential,
                sharedCredentials
            );

        if (warning) {
            log("WARN", warning);
        }

        return credentials;
    } catch (e) {
        log("ERROR", "Error parsing URL for credential resolution:", e);
        return [];
    }
}

/**
 * Update declarativeNetRequest rules for header injection
 * Rules are applied just-in-time before navigation
 */
async function updateDeclarativeNetRequestRules(credentials) {
    const headerRules = [];

    // Get all existing session rules
    const existingRules = await chrome.declarativeNetRequest.getSessionRules();
    const removeRuleIds = existingRules.map((rule) => rule.id);

    // Create a rule for each credential
    credentials.forEach((cred, index) => {
        const validationError = CredentialUtils.getCredentialValidationError(
            cred
        );
        if (validationError === "unsupported_type") {
            return;
        }

        if (validationError === "missing_domain") {
            log("WARN", "Skipping credential with missing domain");
            return;
        }

        if (validationError === "invalid_key_value") {
            log("WARN", "Skipping credential with invalid key/value", cred);
            return;
        }

        headerRules.push({
            id: index + 1,
            priority: 1,
            action: {
                type: "modifyHeaders",
                requestHeaders: [
                    {
                        header: cred.key,
                        operation: "set",
                        value: cred.value,
                    },
                ],
            },
            condition: {
                // Use regexFilter so credentials only apply to exact hostname.
                regexFilter: CredentialUtils.buildExactHostRegex(cred.domain),
                resourceTypes: [
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
                ],
            },
        });
    });

    // Update rules
    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds,
        addRules: headerRules,
    });
}

/**
 * Activate a content item
 * - Resolve credentials
 * - Update header rules
 * - Navigate to the URL or video player
 * - Set alarm for cycling
 */
async function activateItem(index) {
    const config = await configPromise;
    if (!config || !config.content || config.content.length === 0) {
        log("ERROR", "No content configured");
        return;
    }

    const content = config.content;
    if (index >= content.length) {
        index = 0;
    }

    const item = content[index];
    log("INFO", `Activating content item ${index}:`, item);

    // Convert S3 URLs and build target URL
    let targetUrl = convertS3Url(item.url);

    // Resolve credentials
    const credentials = resolveCredentials(
        targetUrl,
        item.credential,
        config.sharedCredentials
    );

    // Update header rules
    await updateDeclarativeNetRequestRules(credentials);



    if (item.type === "video") {
        // Video items navigate to a special player page
        const videoPlayerUrl = chrome.runtime.getURL("pages/video/index.html");
        const encodedUrl = encodeURIComponent(targetUrl);
        const scale = item.scale || "1";
        targetUrl = `${videoPlayerUrl}?url=${encodedUrl}&scale=${scale}`;
        log("INFO", `Video player URL: ${targetUrl}`);
    } else if (item.scale) {
        // Store scale in session storage for the extension to apply
        await chrome.storage.local.set({ currentScale: item.scale });
    } else {
        await chrome.storage.local.remove("currentScale");
    }

    // Get the active tab and navigate
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
        log("INFO", `Navigating tab ${tabs[0].id} to: ${targetUrl}`);
        await chrome.tabs.update(tabs[0].id, { url: targetUrl });
    } else {
        log("WARN", "No active tab found, creating new tab");
        await chrome.tabs.create({ url: targetUrl });
    }

    // Save current index and set alarm for next item
    await chrome.storage.local.set({ currentIndex: index });

    if (content.length > 1) {
        // Duration is in seconds, alarms expect minutes or hours
        const durationMinutes = Math.max(
            1 / 60,
            (item.duration || 10) / 60
        );
        chrome.alarms.create("advance_content", { delayInMinutes: durationMinutes });
    }
}

/**
 * Initialize cycling
 */
async function initializeCycling() {
    const config = await configPromise;
    if (config && config.content && config.content.length > 0) {
        const data = await chrome.storage.local.get(["currentIndex"]);
         const startIndex = data.currentIndex ?? 0;
         await activateItem(startIndex);
    } else {
        // No content configured, show unconfigured page
        log("WARN", "No content configured, navigating to unconfigured page");
        const unconfiguredUrl = chrome.runtime.getURL("pages/unconfigured/index.html");
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) {
            await chrome.tabs.update(tabs[0].id, { url: unconfiguredUrl });
        } else {
            await chrome.tabs.create({ url: unconfiguredUrl });
        }
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.type === "errorDetails") {
        sendResponse(tabErrors[sender.tab.id]);
    } else if (request.type === "updateLocation") {
        chrome.tabs.update(sender.tab.id, { url: request.url });
    } else if (request.type === "start_cycling") {
        await initializeCycling();
    }
});

// Listen for alarm to advance to next content
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "advance_content") {
        const config = await configPromise;
        if (!config || !config.content || config.content.length === 0) {
            return;
        }

        const data = await chrome.storage.local.get(["currentIndex"]);
        let currentIndex = data.currentIndex || 0;
        const nextIndex = (currentIndex + 1) % config.content.length;

        if (config.content.length > 1) {
            await activateItem(nextIndex);
        }
    }
});

// Error detection: listen for network errors
chrome.webRequest.onErrorOccurred.addListener(
    onErrorOccurred,
    {
        urls: ["<all_urls>"],
    }
);

// Error detection: listen for HTTP errors
chrome.webRequest.onHeadersReceived.addListener(
    onHeadersReceived,
    {
        urls: ["<all_urls>"],
        types: ["main_frame"],
    }
);

async function onHeadersReceived(details) {
    if (details.statusCode > 399) {
        tabErrors[details.tabId] = details;
        await chrome.tabs.update(details.tabId, {
            url: chrome.runtime.getURL("pages/error/index.html"),
        });
    }
}

async function onErrorOccurred(details) {
    if (
        !details.parentDocumentId &&
        !details.documentId &&
        details.documentLifecycle === "active" &&
        details.error !== "net::ERR_ABORTED"
    ) {
        tabErrors[details.tabId] = details;
        await chrome.tabs.update(details.tabId, {
            url: chrome.runtime.getURL("pages/error/index.html"),
        });
    }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ currentIndex: 0 });
});

// Start cycling when the service worker wakes up
initializeCycling();

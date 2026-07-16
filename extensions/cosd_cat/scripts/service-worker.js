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

// chrome.runtime.onInstalled.addListener(() => {
//   // Save your initial state
//   chrome.storage.local.set({ 
//     urls: ["https://bbc.co.uk", "https://postman-echo.com/headers", "https://octopus.energy"], 
//     currentIndex: 0 
//   });
  
//   // Create an alarm to fire every 1 minute
//   chrome.alarms.create("cycle-urls", { periodInMinutes: 1 });
// });

// // 2. Listen for the alarm to wake up the service worker
// chrome.alarms.onAlarm.addListener(async (alarm) => {
//   if (alarm.name === "cycle-urls") {
    
//     // Retrieve the durable state
//     const data = await chrome.storage.local.get(["urls", "currentIndex"]);
//     const urls = data.urls || [];
//     let index = data.currentIndex || 0;

//     if (urls.length > 0) {
//       const nextUrl = urls[index];
      
//       // Update the currently active tab (or create a new one)
//       const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
//       if (activeTab) {
//           await chrome.tabs.update(activeTab.id, { url: nextUrl });
//       } else {
//           await chrome.tabs.create({ url: nextUrl });
//       }

//       // Increment index, loop back to 0 if at the end, and save
//       const nextIndex = (index + 1) % urls.length;
//       await chrome.storage.local.set({ currentIndex: nextIndex });
//     }
//   }
// });

// Create the offscreen document if it doesn't exist
async function setupOffscreenDocument(path) {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(path)]
  });

  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['DOM_SCRAPING'], // Required field, any valid reason works here
    justification: 'Timer for URL cycling'
  });
}

chrome.runtime.onInstalled.addListener(() => {
  // Initialize state
  chrome.storage.local.set({ urls: ["https://kraken.octopus.energy/realtime-dashboards/views/redirect/BRI02-FLR02-05", "https://postman-echo.com/headers"], currentIndex: 0 });
  setupOffscreenDocument('offscreen.html');
});

//http://proxy:8080/realtime-dashboards/views/redirect/BRI02-FLR02-05/

// Listen for the fast ticks from the offscreen document
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "cycle_url") {
    chrome.storage.local.get(["urls", "currentIndex"], async (data) => {
      const urls = data.urls || [];
      let index = data.currentIndex || 0;

      if (urls.length > 0) {
        const nextUrl = urls[index];
        
        // Update active tab
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
          await chrome.tabs.update(activeTab.id, { url: nextUrl });
        }

        // Increment and save
        chrome.storage.local.set({ currentIndex: (index + 1) % urls.length });
      }
    });
  }
});
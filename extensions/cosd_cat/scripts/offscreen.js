setInterval(() => {
  chrome.runtime.sendMessage({ action: "cycle_url" });
}, 10000);
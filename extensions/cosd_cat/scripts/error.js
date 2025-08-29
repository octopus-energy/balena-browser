const errorDetails = await chrome.runtime.sendMessage(
    chrome.runtime.id,
    "errorDetails"
);

if (!errorDetails || !errorDetails.error) {
    document.getElementById(
        "errorDetails"
    ).innerHTML = `No error provided by service worker.`;
} else {
    document.getElementById(
        "errorDetails"
    ).innerHTML = `${errorDetails.error} when trying to access ${errorDetails.url}`;
}

async function countdownReload(seconds) {
    if (seconds == 0) {
        window.location.assign(errorDetails.url);
        document.getElementById("countdown").innerHTML = `Retrying...`;
    } else {
        document.getElementById(
            "countdown"
        ).innerHTML = `Retrying in ${seconds}s`;
        setTimeout(function () {
            countdownReload(seconds - 1);
        }, 1000);
    }
}

chrome.storage.local.get().then((result) => {
    countdownReload(result.reloadOnErrorTimer || 30);
});

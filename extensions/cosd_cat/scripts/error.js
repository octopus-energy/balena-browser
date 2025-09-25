chrome.runtime
    .sendMessage(chrome.runtime.id, "errorDetails")
    .then((errorDetails) => {
        const errorDetailsElement = document.getElementById("errorDetails");
        if (errorDetails.error) {
            errorDetailsElement.innerHTML = `${errorDetails.error} when trying to access ${errorDetails.url}`;
        } else if (errorDetails.statusLine) {
            errorDetailsElement.innerHTML = `${errorDetails.statusLine} when trying to access ${errorDetails.url}`;
        } else {
            errorDetailsElement.innerHTML = `No error provided by service worker.`;
        }
    }).catch((e) => {
        document.getElementById("errorDetails").innerHTML = `No error provided by service worker.`;
    });

function countdownReload(seconds) {
    if (seconds == 0) {
        setStorage(Math.min(300, countdownTimer * 2));
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

chrome.storage.local.get("errorCountdown").then((result) => {
    let errorCountdown = result.errorCountdown;

    if (!errorCountdown || errorCountdown.nextCountdown == null) {
        countdownTimer = 5;
    } else if (errorCountdown.previousRefresh !== null) {
        countdownTimer = Math.max(
            5,
            errorCountdown.nextCountdown -
                (Math.floor(Date.now() / 1000) - errorCountdown.previousRefresh)
        );
    }
    countdownReload(countdownTimer);
});

function setStorage(nextCountdown) {
    chrome.storage.local.set({
        errorCountdown: {
            previousRefresh: Math.floor(Date.now() / 1000),
            nextCountdown: nextCountdown,
        },
    });
}
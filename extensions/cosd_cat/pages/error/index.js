const videoError = new URLSearchParams(window.location.search).get("videoError");
var countdownTimer;
var errorDetails;

chrome.runtime
    .sendMessage(chrome.runtime.id, {type: "errorDetails"})
    .then((receivedErrorDetails) => {
        errorDetails = receivedErrorDetails
        const errorDetailsElement = document.getElementById("errorDetails");
        if (videoError) {
            // case for if mpv quits without a status code 0
            errorDetailsElement.innerText = videoError;
        } else if (errorDetails.statusLine) {
            // case for if we get a status code > 399 on the configured upstreamUrl
            errorDetailsElement.innerText = `${errorDetails.statusLine} when trying to access ${errorDetails.url}`;
        } else if (errorDetails.error) {
            // case for if we don't get an http status code, but get a chrome error (dns, network, etc)
            errorDetailsElement.innerText = `${errorDetails.error} when trying to access ${errorDetails.url}`;
        } else {
            errorDetailsElement.innerText = `No error provided by service worker.`;
        }
    })
    .catch((e) => {
        document.getElementById(
            "errorDetails"
        ).innerText = `Something went wrong: ${e}`;
    });

function countdownReload(seconds) {
    if (seconds == 0) {
        setStorage(Math.min(300, countdownTimer * 2));
        document.getElementById("countdown").innerText = `Retrying...`;
        if (videoError) {
            // if this is a video error, we want to close the last tab in chrome (this tab)
            // and return back to the parent script (startweston.sh) to let mpv try and play
            // the video again
            setTimeout(self.close, 1000);
        } else {
            // if it's anything else we just try the url again
            window.location.assign(errorDetails.url);
        }
    } else {
        document.getElementById(
            "countdown"
        ).innerText = `Retrying in ${seconds}s`;
        setTimeout(function () {
            countdownReload(seconds - 1);
        }, 1000);
    }
}

chrome.storage.local.get("errorCountdown").then((result) => {
    let errorCountdown = result.errorCountdown;
    console.log(errorCountdown);

    if (!errorCountdown || errorCountdown.nextCountdown == null) {
        countdownTimer = 5;
    } else if (errorCountdown.previousRefresh !== null) {
        countdownTimer = errorCountdown.nextCountdown;
        var adjustedCountdownTimer = Math.max(
            5,
            errorCountdown.nextCountdown -
                (Math.floor(Date.now() / 1000) - errorCountdown.previousRefresh)
        );
    }
    countdownReload(adjustedCountdownTimer || countdownTimer);
});

function setStorage(nextCountdown) {
    chrome.storage.local.set({
        errorCountdown: {
            previousRefresh: Math.floor(Date.now() / 1000),
            nextCountdown: nextCountdown,
        },
    });
}

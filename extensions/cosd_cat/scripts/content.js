const cat = document.createElement("div");
const errorPage = window.location.href.includes(chrome.runtime.id + "/error");

cat.style.cssText = `
position: fixed;
padding: calc(2px / var(--balena-display-scale));
bottom: 0;
left: 0;
background-color: #180048;
display: block;
z-index: 2147483647;
line-height: normal;
color: #60F0F8;
font-size: calc(var(--font-size) / var(--balena-display-scale));`;

async function setOSD() {
    // get the entire extension storage object
    chrome.storage.local.get().then((result) => {
        if (result.showDeviceTag == "0") {
            clearInterval(intervalId);
        } else if (result.balenaId != undefined) {
            // set the device slug
            cat.innerHTML = result.balenaId;

            // set the known css attributes
            cat.style.setProperty(
                "--balena-display-scale",
                result.displayScale || 1
            );
            cat.style.setProperty("--font-size", result.fontSize || "18px");
            cat.style.setProperty(
                "font-family",
                result.fontFamily || "sans-serif"
            );

            // set arbitrary css attributes
            if (result.css != undefined) {
                for (var attr in result.css) {
                    cat.style[attr] = result.css[attr];
                }
            }

            document.body.append(cat);

            if (errorPage) {
                document.getElementById("screenIdentifier").innerHTML =
                    result.balenaId;
            }

            // don't run this function again after it's ran successfully
            clearInterval(intervalId);
        }
    });
}

let intervalId;

// observers don't work within the chrome-extension:// pages
if (errorPage) {
    intervalId = setInterval(setOSD, 1000);
    setOSD();
} else {
    ("use strict");

    var observer = new MutationObserver(function () {
        if (document.body) {
            intervalId = setInterval(setOSD, 1000);
            setOSD();
            observer.disconnect();
        }
    });
    observer.observe(document.documentElement, { childList: true });
}

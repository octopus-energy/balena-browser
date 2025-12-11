const cat = document.createElement("div");
const fillTagElement =
    window.location.href.includes(chrome.runtime.id + "/pages/error") ||
    window.location.href.includes(chrome.runtime.id + "/pages/unconfigured");

const startPage = window.location.href.includes(
    "file:///home/chromium/loading.html"
);

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

async function setOSD(config) {
    // get the entire extension storage object
    if (config.balenaId != undefined && config.showDeviceTag != "0") {
        // set the device slug
        cat.innerHTML = config.balenaId;

        // set the known css attributes
        cat.style.setProperty(
            "--balena-display-scale",
            config.displayScale || 1
        );
        cat.style.setProperty("--font-size", config.fontSize || "18px");
        cat.style.setProperty("font-family", config.fontFamily || "sans-serif");

        // set arbitrary css attributes
        if (config.css != undefined) {
            for (var attr in config.css) {
                cat.style[attr] = config.css[attr];
            }
        }

        if (config.showCursor == "0") {
            hideCursor();
        }

        await waitForBody();

        document.body.append(cat);

        if (fillTagElement) {
            document.getElementById("screenIdentifier").innerHTML =
                config.balenaId;
        }
    }
}

function waitForBody() {
    return new Promise(resolve => {
        if (document.body) {
            return resolve(document.body);
        }

        const observer = new MutationObserver(() => {
            if (document.body) {
                observer.disconnect();
                resolve(document.body);
            }
        });

        observer.observe(document, {
            childList: true,
            subtree: true
        });
    });
}

function updateLocation(location) {
    chrome.runtime.sendMessage(chrome.runtime.id, {
        type: "updateLocation",
        url: location,
    });
}

function hideCursor() {
    var css = "* { cursor: none; }",
        head = document.head || document.getElementsByTagName("head")[0],
        style = document.createElement("style");

    head.appendChild(style);

    style.appendChild(document.createTextNode(css));
}

fetch(chrome.runtime.getURL("config.json"))
    .then((resp) => {
        resp.json().then((config) => {
            if (startPage) {
                console.log(`Redirecting to ${config.startingUrl}`);
                setTimeout(() => {updateLocation(config.startingUrl)}, 1000);
            } else {
                setOSD(config);
            }
        });
    })
    .catch((e) => {
        console.log(e);
    });

const cat = document.createElement("div");
const fillTagElement =
    window.location.href.includes(chrome.runtime.id + "/pages/error") ||
    window.location.href.includes(chrome.runtime.id + "/pages/unconfigured");

const startPage = window.location.href.includes(
    "file:///home/chromium/loading.html"
);

async function setOSD(config) {
    // get the entire extension storage object
    if (config.balenaId != undefined) {
        // set the device slug
        cat.innerHTML = config.balenaId;

        // Get the values
        const displayScale = config.displayScale || 1;
        const fontSize = config.fontSize || "18px";
        const fontFamily = config.fontFamily || "sans-serif";

        // Use setProperty for all styles - this is more reliable than cssText for custom properties
        cat.style.setProperty("position", "fixed");
        cat.style.setProperty("padding", `calc(2px / ${displayScale})`);
        cat.style.setProperty("bottom", "0");
        cat.style.setProperty("left", "0");
        cat.style.setProperty("background-color", "#180048");
        cat.style.setProperty("display", "block");
        cat.style.setProperty("z-index", "2147483647");
        cat.style.setProperty("line-height", "normal");
        cat.style.setProperty("color", "#60F0F8");
        cat.style.setProperty("font-size", `calc(${fontSize} / ${displayScale})`);
        cat.style.setProperty("font-family", fontFamily);

        // set arbitrary css attributes
        if (config.css != undefined) {
            for (var attr in config.css) {
                cat.style[attr] = config.css[attr];
            }
        }

        // Apply per-content scale via CSS zoom if set in local storage
        const data = await chrome.storage.local.get(["currentScale"]);
        if (data.currentScale) {
            document.documentElement.style.zoom = data.currentScale;
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
            log("INFO", "Config loaded:", config);
            if (startPage) {
                // On loading page, trigger the service worker to start cycling
                log("INFO", "Loading page detected - starting content cycling");
                chrome.runtime.sendMessage(chrome.runtime.id, {
                    type: "start_cycling",
                });
            } else {
                setOSD(config);
            }
        });
    })
    .catch((e) => {
        log("ERROR", "Failed to load config.json:", e);
    });

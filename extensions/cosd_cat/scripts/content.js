const cat = document.createElement("div");

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
    chrome.storage.local.get().then((result) => {
        if (result.balenaId != undefined) {
            cat.innerHTML = result.balenaId;
            cat.style.setProperty("--balena-display-scale", result.displayScale || 1);
            cat.style.setProperty("--font-size", result.fontSize || "18px");
            cat.style.setProperty("font-family", result.fontFamily || "sans-serif");
            if (result.css != undefined) {
                for ([key, value] of Object.entries(result.css)) {
                    cat.style[key] = value;
                }
            }
            document.body.append(cat);
            clearInterval(intervalId);
        }
    });
}

let intervalId = setInterval(setOSD, 1000);
setOSD();

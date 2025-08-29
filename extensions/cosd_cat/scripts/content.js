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

async function setOSD(config) {
    // get the entire extension storage object
    if (config.balenaId != undefined) {
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

        if (document.body == null) {
            document.body = document.createElement("body");
        }

        document.body.append(cat);

        if (errorPage) {
            document.getElementById("screenIdentifier").innerHTML =
                config.balenaId;
        }
    }
}

fetch(chrome.runtime.getURL("config.json")).then((resp) => {
    resp.json().then((config) => {
        setOSD(config);
    });
}).catch((e) => {console.log(e)});

#!/bin/env node

const express = require("express");
const bodyParser = require("body-parser");
const chromeLauncher = require("chrome-launcher");
const CDP = require("chrome-remote-interface");
const schedule = require("node-schedule");
const bent = require("bent");
const {
    setIntervalAsync,
    clearIntervalAsync,
} = require("set-interval-async/dynamic");
const { spawn } = require("child_process");
const { readFile, unlink } = require("fs").promises;
const path = require("path");
const os = require("os");
const fs = require("fs");

// Bring in the static environment variables
const API_PORT = parseInt(process.env.API_PORT) || 5011;
const DISPLAY_SCALE = process.env.DISPLAY_SCALE || "1.0";
const LAUNCH_URLS = (
    process.env.LAUNCH_URL || "file:///home/chromium/index.html"
).split(",");
const REFRESH_SCHEDULE = process.env.REFRESH_SCHEDULE || 0;
const ROTATE_SCHEDULE = process.env.ROTATE_SCHEDULE || 0;
const RELOAD_ON_ERROR = process.env.RELOAD_ON_ERROR || 1;
const RELOAD_ON_ERROR_TIMER = (process.env.RELOAD_ON_ERROR_TIMER || 5) * 1000;
const PERSISTENT_DATA = process.env.PERSISTENT || "0";
const REMOTE_DEBUG_PORT = process.env.REMOTE_DEBUG_PORT || 35173;
const FLAGS = process.env.FLAGS || null;
const EXTRA_FLAGS = process.env.EXTRA_FLAGS || null;
const HTTPS_REGEX = /^https?:\/\//i; //regex for HTTP/S prefix
const AUTO_REFRESH = process.env.AUTO_REFRESH || 0;
const FLEET_NAME = process.env.BALENA_APP_NAME || "unknown-fleet";
const DEVICE_NAME = process.env.BALENA_DEVICE_NAME_AT_INIT || "unknown-device";
const SHOW_DEVICE_TAG = process.env.SHOW_DEVICE_TAG || "1";
const OSD_CSS = parseJson(process.env.OSD_CSS);
const OSD_FONT_SIZE = process.env.OSD_FONT_SIZE || "18px";
const OSD_FONT_FAMILY = process.env.OSD_FONT_FAMILY || "helvetica";

// Environment variables which can be overriden from the API
let kioskMode = process.env.KIOSK || "0";
let enableGpu = process.env.ENABLE_GPU || "0";

let DEFAULT_FLAGS = [];
let currentUrl = "";
let nextUrlIndex = 0;
let flags = [];

// Refresh timer object
let timer = {};

function parseJson(string) {
    try {
        return JSON.parse(string);
    } catch (e) {
        return undefined;
    }
}

// Returns the URL to display, adhering to the hieracrchy:
// 1) the configured LAUNCH_URL
// 2) a discovered HTTP service on the device
// 3) the default static HTML
async function getUrlToDisplayAsync() {
    nextUrl = LAUNCH_URLS[nextUrlIndex++];
    if (nextUrlIndex >= LAUNCH_URLS.length) {
        nextUrlIndex = 0;
    }
    let launchUrl = nextUrl || null;
    if (null !== launchUrl) {
        console.log(`Using LAUNCH_URL: ${launchUrl}`);

        // Prepend http:// if the LAUNCH_URL doesn't have it.
        // This is needed for the --app flag to be used for kiosk mode
        if (!HTTPS_REGEX.test(launchUrl)) {
            launchUrl = `http://${launchUrl}`;
        }

        return launchUrl;
    }

    console.log("LAUNCH_URL environment variable not set.");

    return returnURL;
}

// Launch the browser with the URL specified
let launchChromium = async function (url) {
    await chromeLauncher.killAll();

    flags = [];
    // If the user has set the flags, use them
    if (null !== FLAGS) {
        flags = FLAGS.split(" ");
    } else {
        // User the default flags from chrome-launcher, plus our own.
        flags = DEFAULT_FLAGS;
        let balenaFlags = [
            "--ozone-platform=wayland",
            "--autoplay-policy=no-user-gesture-required",
            "--noerrdialogs",
            "--disable-session-crashed-bubble",
            "--check-for-update-interval=31536000",
        ];

        // Merge the chromium default and balena default flags
        flags = flags.concat(balenaFlags);

        // either disable the gpu or set some flags to enable it
        if (enableGpu != "1") {
            console.log("Disabling GPU");
            flags.push("--disable-gpu");
        } else {
            console.log("Enabling GPU");
            let gpuFlags = [
                "--enable-zero-copy",
                "--num-raster-threads=4",
                "--ignore-gpu-blocklist",
                "--enable-gpu-rasterization",
            ];

            flags = flags.concat(gpuFlags);
        }
    }

    if (EXTRA_FLAGS) {
        flags = flags.concat(EXTRA_FLAGS.split(" "));
    }

    let startingUrl = "http://proxy:8080/nonproxied/unconfigured/";
    if ("1" === kioskMode) {
        console.log("Enabling KIOSK mode");
        startingUrl = `--app= ${startingUrl}`;
    } else {
        console.log("Disabling KIOSK mode");
    }

    console.log(`Starting Chromium with flags: ${flags}`);
    console.log(`Displaying URL: ${startingUrl}`);

    const chrome = await chromeLauncher.launch({
        startingUrl: startingUrl,
        ignoreDefaultFlags: true,
        chromeFlags: flags,
        port: REMOTE_DEBUG_PORT,
        connectionPollInterval: 1000,
        maxConnectionRetries: 120,
        userDataDir: "1" === PERSISTENT_DATA ? "/data/chromium" : undefined,
    });

    console.log(
        `Chromium remote debugging tools running on port: ${chrome.port}`
    );
    let client = null;
    try {
        client = await CDP({
            port: REMOTE_DEBUG_PORT,
        });

        if (RELOAD_ON_ERROR !== 0) {
            const { Network } = client;

            try {
                // Listen for network responses and refresh after 5 seconds if
                // the main document finished loading with a non-success
                // HTTP error code
                Network.responseReceived(async (params) => {
                    if (
                        params.type === "Document" &&
                        params.response.status > 399
                    ) {
                        console.log(
                            `Document finished loading with HTTP error code ${params.response.status}`
                        );
                        setTimeout(async () => {
                            await reloadPage(client);
                        }, RELOAD_ON_ERROR_TIMER);
                    }
                });

                await Network.enable();
            } catch (err) {
                console.error(`Could not set up Network events. Error: ${err}`);
            }
        }

        // Go to the first URL now that CDP has beend loaded
        // and Network events are being listened to
        await goToUrl(client, url);
    } catch (err) {
        console.error(`Could not connect to Chrome via CDP. Error: ${err}`);
    }
    currentUrl = url;
    return client;
};
async function goToUrl(cdpClient, url) {
    console.log(`Navigating to URL: ${url}`);
    try {
        await cdpClient.Page.navigate({ url: url });
    } catch (err) {
        console.error(`Could not navigate to URL via CDP. Error: ${err}`);
    }
}

async function reloadPage(cdpClient) {
    console.log("Refreshing page.");
    await goToUrl(cdpClient, LAUNCH_URLS[nextUrlIndex]);
}

// Get's the chrome-launcher default flags, minus the extensions and audio muting flags.
async function SetDefaultFlags() {
    DEFAULT_FLAGS = await chromeLauncher.Launcher.defaultFlags().filter(
        (flag) => "--disable-extensions" !== flag && "--mute-audio" !== flag
    );
}

async function setExtensionStorage() {
    const extensionConfig = {
        balenaId: `${FLEET_NAME}/${DEVICE_NAME}`,
        displayScale: DISPLAY_SCALE,
        css: OSD_CSS,
        fontSize: OSD_FONT_SIZE,
        fontFamily: OSD_FONT_FAMILY,
        showDeviceTag: SHOW_DEVICE_TAG,
        reloadOnErrorTimer: RELOAD_ON_ERROR_TIMER,
    };
    const jsonData = JSON.stringify(extensionConfig);

    fs.writeFile(
        "/usr/share/chromium/extensions/cosd_cat/config.json",
        jsonData,
        "utf8",
        (err) => {
            if (err) {
                console.error("Error writing config to file", err);
            } else {
                console.log("Config written to file");
            }
        }
    );
}

async function setTimer(interval) {
    console.log("Auto refresh interval: ", interval);
    timer = setIntervalAsync(async () => {
        try {
            await launchChromium(currentUrl);
        } catch (err) {
            console.log("Timer error: ", err);
            process.exit(1);
        }
    }, interval);
}

async function clearTimer() {
    await clearIntervalAsync(timer);
}

async function main() {
    await SetDefaultFlags();
    await setExtensionStorage();
    let url = await getUrlToDisplayAsync();
    await launchChromium(url);
    if (AUTO_REFRESH > 0) {
        await setTimer(AUTO_REFRESH * 1000);
    }
    const cdpClient = await launchChromium(url);

    if (cdpClient != null) {
        if (LAUNCH_URLS.length > 1 && ROTATE_SCHEDULE !== 0) {
            schedule.scheduleJob(ROTATE_SCHEDULE, async () => {
                let url = await getUrlToDisplayAsync();
                await goToUrl(cdpClient, url);
            });
        }

        if (REFRESH_SCHEDULE !== 0) {
            schedule.scheduleJob(
                REFRESH_SCHEDULE,
                async () => await reloadPage(cdpClient)
            );
        }
    } else {
        console.log(
            "WARNING - CDP client is null and so refresh and rotate schedules are not available."
        );
    }
}

main().catch((err) => {
    console.log("Main error: ", err);
    process.exit(1);
});

process.on("SIGINT", () => {
    process.exit();
});

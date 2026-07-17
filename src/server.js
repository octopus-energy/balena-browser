#!/bin/env node

const chromeLauncher = require("chrome-launcher");
const CDP = require("chrome-remote-interface");
const express = require("express");
const path = require('path');
const { spawn } = require('child_process');
const { readFile, unlink } = require('fs').promises;
const os = require('os');
const schedule = require("node-schedule");
const fs = require("fs");

const DISPLAY_SCALE = process.env.DISPLAY_SCALE || "1.0";
const CONTENT = parseJson(process.env.CONFIG_DISPLAY);
const SHARED_CREDENTIALS = parseJson(process.env.SHARED_CREDENTIALS);
const RELOAD_ON_ERROR = process.env.RELOAD_ON_ERROR || 0;
const RELOAD_ON_ERROR_TIMER = (process.env.RELOAD_ON_ERROR_TIMER || 5) * 1000;
const PERSISTENT_DATA = process.env.PERSISTENT || "0";
const REMOTE_DEBUG_PORT = process.env.REMOTE_DEBUG_PORT || 35173;
const FLAGS = process.env.FLAGS || null;
const EXTRA_FLAGS = process.env.EXTRA_FLAGS || null;
const FLEET_NAME = process.env.BALENA_APP_NAME || "unknown-fleet";
const DEVICE_NAME = process.env.BALENA_DEVICE_NAME_AT_INIT || "unknown-device";
const SHOW_DEVICE_TAG = process.env.SHOW_DEVICE_TAG || "1";
const OSD_CSS = parseJson(process.env.OSD_CSS);
const OSD_FONT_SIZE = process.env.OSD_FONT_SIZE || "18px";
const OSD_FONT_FAMILY = process.env.OSD_FONT_FAMILY || "helvetica";
const SHOW_CURSOR = process.env.SHOW_CURSOR || "0";

// Environment variables which can be overriden from the API
let kioskMode = process.env.KIOSK || "0";
let enableGpu = process.env.ENABLE_GPU || "0";

let DEFAULT_FLAGS = [];
let flags = [];

function parseJson(string) {
    try {
        return JSON.parse(string);
    } catch (e) {
        return undefined;
    }
}

// Launch the browser with the URL specified
let launchChromium = async function () {
    let url = "file:///home/chromium/loading.html";
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
            "--hide-scrollbars",
            "--disable-session-crashed-bubble",
            "--check-for-update-interval=31536000",
            "--disk-cache-size=2147483647",
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

    if ("1" === kioskMode) {
        console.log("Enabling KIOSK mode");
        flags.push('--kiosk');
    } else {
        console.log("Disabling KIOSK mode");
    }

    console.log(`Starting Chromium with flags: ${flags}`);
    console.log(`Displaying URL: ${url}`);

    const chrome = await chromeLauncher.launch({
        startingUrl: url,
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
        console.log(`Connected to Chrome via CDP!`);
        if (RELOAD_ON_ERROR != 0) {
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
    } catch (err) {
        console.error(`Could not connect to Chrome via CDP. Error: ${err}`);
    }
    currentUrl = url;
    return { cdpClient: client, chrome: chrome };
};


// Get's the chrome-launcher default flags, minus the extensions and audio muting flags.
async function SetDefaultFlags() {
    DEFAULT_FLAGS = await chromeLauncher.Launcher.defaultFlags().filter(
        (flag) => "--disable-extensions" !== flag && "--mute-audio" !== flag
    );
}

async function setExtensionStorage() {
    let sharedCredentials = {};

    if (
        SHARED_CREDENTIALS &&
        typeof SHARED_CREDENTIALS === "object" &&
        !Array.isArray(SHARED_CREDENTIALS)
    ) {
        sharedCredentials = SHARED_CREDENTIALS;
    } else if (SHARED_CREDENTIALS !== undefined) {
        console.warn(
            "SHARED_CREDENTIALS must be a JSON object keyed by domain; ignoring invalid value"
        );
    }

    const extensionConfig = {
        balenaId: `${FLEET_NAME}/${DEVICE_NAME}`,
        displayScale: DISPLAY_SCALE,
        css: OSD_CSS,
        fontSize: OSD_FONT_SIZE,
        fontFamily: OSD_FONT_FAMILY,
        showDeviceTag: SHOW_DEVICE_TAG,
        reloadOnErrorTimer: RELOAD_ON_ERROR_TIMER,
        showCursor: SHOW_CURSOR,
        content: CONTENT || [],
        sharedCredentials,
    };
    const jsonData = JSON.stringify(extensionConfig);

    try {
        await fs.promises.writeFile(
            "/usr/share/chromium/extensions/cosd_cat/config.json",
            jsonData,
            "utf8"
        );
        console.log("Config written to file");
    } catch (err) {
        console.error("Error writing config to file", err);
        throw err;
    }
}

async function main() {
    await SetDefaultFlags();
    await setExtensionStorage();
    const cdpClient = await launchChromium();
}

main().catch((err) => {
    console.log("Main error: ", err);
    process.exit(1);
}).then(() => {
    fs.stat('/var/lock/chromium-starting.lock', function (err) {
        if (err) {
            return console.error(err);
        }

        fs.unlink('/var/lock/chromium-starting.lock', function (err) {
            if (err) return console.log(err);
            console.log('Deleted /var/lock/chromium-starting.lock');
        });
    });
});

process.on("SIGINT", async () => {
    process.exit();
});

const app = express();

app.get('/screenshot', (req, res) => {
    res.set('Content-Type', 'image/webp');

    const grim = spawn('grim', ['-l', '0', '-']);

    const cwebp = spawn('cwebp', ['-quiet', '-resize', '1280', '0', '-o', '-', '--', '-']);

    grim.stdout.pipe(cwebp.stdin);
    cwebp.stdout.pipe(res);

    grim.on('error', (err) => {
        console.error('Grim failed to start:', err);
        if (!res.headersSent) res.status(500).send('Screenshot generation failed.');
    });

    cwebp.on('error', (err) => {
        console.error('cwebp failed to start:', err);
        if (!res.headersSent) res.status(500).send('WebP conversion failed.');
    });

    grim.on('close', (code) => {
        if (code !== 0) console.error(`Grim crashed with exit code ${code}`);
    });

    cwebp.on('close', (code) => {
        if (code !== 0) console.error(`cwebp crashed with exit code ${code}`);
    });
});

app.listen(8080, () => {
    console.log('Browser API running on port: ' + 8080);
});

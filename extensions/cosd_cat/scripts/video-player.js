log('INFO', 'Video player initializing...');

async function setupOSD() {
    try {
        const response = await fetch(chrome.runtime.getURL("config.json"));
        const config = await response.json();
        
        if (config.balenaId) {
            const osd = document.createElement("div");
            osd.textContent = config.balenaId;

            // This is for the error display on the screen
            const screenIdentifier = document.getElementById("screenIdentifier");
            if (screenIdentifier) {
                screenIdentifier.textContent = config.balenaId;
            }
            
            const displayScale = config.displayScale || 1;
            const fontSize = config.fontSize || "18px";
            const fontFamily = config.fontFamily || "sans-serif";
            
            osd.style.setProperty("position", "fixed");
            osd.style.setProperty("padding", `calc(2px / ${displayScale})`);
            osd.style.setProperty("bottom", "0");
            osd.style.setProperty("left", "0");
            osd.style.setProperty("background-color", "#180048");
            osd.style.setProperty("display", "block");
            osd.style.setProperty("z-index", "2147483647");
            osd.style.setProperty("line-height", "normal");
            osd.style.setProperty("color", "#60F0F8");
            osd.style.setProperty("font-size", `calc(${fontSize} / ${displayScale})`);
            osd.style.setProperty("font-family", fontFamily);
            
            document.body.appendChild(osd);
        }
    } catch (e) {
        log('ERROR', `Failed to setup OSD: ${e.message}`);
    }
}

setupOSD();
setupPlayer();

function setupPlayer() {
    const params = new URLSearchParams(window.location.search);
    let videoUrl = params.get('url');
    const scale = params.get('scale') || '1';

    if (!videoUrl) {
        log('ERROR', 'No video URL provided');
        return;
    }

    try {
        videoUrl = decodeURIComponent(videoUrl);
    } catch (e) {
        log('ERROR', `URL decode error: ${e.message}`);
    }

    log('INFO', `Playing: ${videoUrl}`);
    document.documentElement.style.zoom = scale;

    const video = document.getElementById('video');
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorOverlay = document.getElementById('error-overlay');
    const errorDetails = document.getElementById('error-details');
    let reportedError = false;

    video.addEventListener('play', () => {
        log('DEBUG', 'Video started');
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    });
    video.addEventListener('error', () => {
        const error = `${video.error?.code}: ${video.error?.message}`;
        log('ERROR', `Video error: ${error}`);
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        if (errorOverlay) errorOverlay.classList.add('visible');
        if (errorDetails) errorDetails.textContent = `${error} when trying to play ${videoUrl}`;

        if (reportedError) {
            return;
        }

        reportedError = true;
        chrome.runtime.sendMessage(chrome.runtime.id, {
            type: 'video_error',
            url: videoUrl,
            error,
        });
    });

    video.src = videoUrl;
}



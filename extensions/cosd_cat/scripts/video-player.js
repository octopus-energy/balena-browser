log('INFO', 'Video player initializing...');

async function setupOSD() {
    try {
        const response = await fetch(chrome.runtime.getURL("config.json"));
        const config = await response.json();
        
        if (config.balenaId) {
            const osd = document.createElement("div");
            osd.innerHTML = config.balenaId;
            
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

    try {
        videoUrl = decodeURIComponent(videoUrl);
    } catch (e) {
        log('ERROR', `URL decode error: ${e.message}`);
    }

    log('INFO', `Playing: ${videoUrl}`);
    document.documentElement.style.zoom = scale;

    const video = document.getElementById('video');
    const loadingOverlay = document.getElementById('loading-overlay');

    if (!videoUrl) {
        log('ERROR', 'No video URL provided');
        return;
    }

    video.src = videoUrl;

    video.addEventListener('play', () => {
        log('DEBUG', 'Video started');
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    });
    video.addEventListener('error', () => {
        log('ERROR', `Video error: ${video.error?.code}: ${video.error?.message}`);
    });
}



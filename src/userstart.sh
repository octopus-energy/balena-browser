#!/usr/bin/env bash

function start_mpv() {
    #!/usr/bin/env bash
    mkdir -p /home/chromium/.config/mpv

    # Download yt-dlp for YouTube videos to play
    YT_DLP=/home/chromium/.config/mpv/yt-dlp

    curl -m 5 -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o $YT_DLP
    chmod a+rx $YT_DLP || true

    # store the LAUNCH_URL in another variable that we don't reuse
    # LAUNCH_URL is changed if there's an error with mpv, so that 
    # chromium can be launched the same way that we launch it when we're
    # showing content in there
    VIDEO_URL=${LAUNCH_URL}

    # check if we have been told to show the device tag or not
    if [ -z ${SHOW_DEVICE_TAG+x} ] || [ "$SHOW_DEVICE_TAG" != "0" ]; then
    echo "SHOW_DEVICE_TAG is set to ${SHOW_DEVICE_TAG}, setting device tag with extra mpv flags:"
    MPV_OSD_CONFIG="--osd-msg1=$BALENA_APP_NAME/$BALENA_DEVICE_NAME_AT_INIT --osd-align-x=left --osd-align-y=bottom --osd-margin-x=0 --osd-margin-y=0 --osd-font-size=12 --osd-border-color=#180048 --osd-color=#60F0F8 --osd-border-size=1 --osd-border-style=opaque-box"
    echo $MPV_OSD_CONFIG
    else
    echo "SHOW_DEVICE_TAG is set to ${SHOW_DEVICE_TAG}, not showing device tag."
    fi

    if ((ROTATE_DISPLAY > 0 && ROTATE_DISPLAY <= 359)); then
        MPV_ROTATE="--video-rotate=${ROTATE_DISPLAY}"
    fi

    while true; do
        set -o pipefail # capture mpv's exit code, not tee's

        mpv \
            --cache=yes \
            --cache-on-disk=yes \
            --video-sync=display-resample \
            --ytdl-raw-options=format-sort=[+hdr] \
            --loop"${LOOP_TYPE}" \
            --fs \
            --quiet \
            --vo=gpu \
            --ao=alsa \
            --network-timeout=5 \
            $MPV_ROTATE \
            $MPV_OSD_CONFIG \
            $EXTRA_MPV_FLAGS \
            $VIDEO_URL 2>&1 | tee mpv.log &

        set +o pipefail # restore default behaviour 

        MPVID=$! # capture mpv's process id

        wait $MPVID # wait for mpv to exit

        MPVEXIT=$? # capture mpv's exit code

        if [ $MPVEXIT -ne 0 ]; then # if mpv did not exit cleanly, show the error page
            VIDEOERROR=$(cat mpv.log | sed -z 's/\n/%0A/g') # convert linebreaks

            # launch the error page within the extension cosd_cat
            LAUNCH_URL="chrome-extension://ljnalmhbggcggncjbchegchjcdockndi/pages/error/index.html?videoError=$VIDEOERROR"

            export PERSISTENT="1"
            # chromium will quit when the script "error.js" in the extension cosd_cat closes the
            # page. this serves as an exponential backoff retry mechanism
            start_chromium
        fi
    done
}

function start_chromium() {
    mkdir -p $HOME/.config
    rm $HOME/.config/weston.ini 

    cat <<EOT >> $HOME/.config/weston.ini
[core]
shell=kiosk
EOT

    # get the names of connected screens and store them in an array
    readarray -t SCREENS < <(for p in /sys/class/drm/*/status; do con=${p%/status}; echo "${con#*/card?-}"; done)

    # set the screen rotation to normal if ROTATE_DISPLAY is unset
    if [ -z "${ROTATE_DISPLAY}" ]; then 
        ROTATE_DISPLAY="normal"; 
    else
        ROTATE_DISPLAY="rotate-${ROTATE_DISPLAY}"
    fi

    # set the correct scale & transformation for each display
    for SCREEN in "${SCREENS[@]}"; do
        cat <<EOT >> $HOME/.config/weston.ini
[output]
name=${SCREEN}
scale=${DISPLAY_SCALE}
transform=${ROTATE_DISPLAY}
EOT
    done

    weston -- /usr/src/app/startweston.sh
}

# translate old style transform values into degree rotations
case $ROTATE_DISPLAY in
    left)
        ROTATE_DISPLAY="270";;
    right)
        ROTATE_DISPLAY="90";;
    inverted)
        ROTATE_DISPLAY="180";;
esac
# set the device tag directly in the loading html in case the extension
# doesn't load
sed -i "s/unconfigured/$BALENA_APP_NAME\/$BALENA_DEVICE_NAME_AT_INIT/g" /home/chromium/loading.html

VIDEO_EXTENSIONS=".webm|.mkv|.flv|.flv|.vob|.ogv|.ogg|.drc|.gif|.gifv|.mng|.avi|.MTS|.M2TS|.TS|.mov|.qt|.wmv|.yuv|.rm|.rmvb|.viv|.asf|.amv|.mp4|.m4p|.m4v|.mpg|.mp2|.mpeg|.mpe|.mpv|.mpg|.mpeg|.m2v|.m4v|.svi|.3gp|.3g2|.mxf|.roq|.nsv|.fl|.f4|.f4|.f4|.f4b"
YOUTUBE_DOMAINS="youtu.be|youtube.com"

if [[ $FORCE_MPV != 0 ]] && \
   [[ $LAUNCH_URL =~ ($VIDEO_EXTENSIONS)$ ]] || \
   [[ $LAUNCH_URL =~ ($YOUTUBE_DOMAINS) ]] || \
   [[ $FORCE_MPV == 1 ]] 
then
    echo "Video, using mpv to play it"
    start_mpv
else
    echo "Not a video, launching Chromium"
    start_chromium
fi
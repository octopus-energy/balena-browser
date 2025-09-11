#!/usr/bin/env bash
cd /data/mpv

# check if we want to show the device tag or not

if [ -z ${SHOW_DEVICE_TAG+x} ] || [ "$SHOW_DEVICE_TAG" != "0" ]; then
  echo "SHOW_DEVICE_TAG is set to ${SHOW_DEVICE_TAG}, setting device tag with extra mpv flags:"
  MPV_OSD_CONFIG="--osd-msg1=$BALENA_APP_NAME/$BALENA_DEVICE_NAME_AT_INIT --osd-align-x=left --osd-align-y=bottom --osd-margin-x=0 --osd-margin-y=0 --osd-font-size=12 --osd-border-color=#180048 --osd-color=#60F0F8 --osd-border-size=1 --osd-border-style=opaque-box"
  echo $MPV_OSD_CONFIG
else
  echo "SHOW_DEVICE_TAG is set to ${SHOW_DEVICE_TAG}, not showing device tag."
fi

set -o pipefail # capture mpv's exit code, not tee's


mpv \
    --cache=yes \
    --cache-on-disk=yes \
    --demuxer-cache-dir=./mpv_cache \
    --video-sync=display-resample \
    --ytdl-raw-options=format-sort=[+hdr] \
    --loop"${LOOP_TYPE}" \
    --fs \
    --quiet \
    --vo=gpu \
    --ao=alsa \
    $MPV_OSD_CONFIG \
    $EXTRA_MPV_FLAGS \
    $LAUNCH_URL 2>&1 | tee mpv.log &

set +o pipefail # restore default behaviour 

MPVID=$! # capture mpv's process id

wait $MPVID # wait for mpv to exit

MPVEXIT=$? # capture mpv's exit code

if [ $MPVEXIT -ne 0 ]; then # if mpv did not exit cleanly, show the error page
  VIDEOERROR=$(cat mpv.log | sed -z 's/\n/%0A/g') # convert linebreaks
  LAUNCH_URL="http://proxy:8080/nonproxied/error/video_error.html?screenIdentifier=$BALENA_APP_NAME/$BALENA_DEVICE_NAME_AT_INIT&videoError=$VIDEOERROR"
  unset DISPLAY_SCALE # we just want to fill the screen
  node /usr/src/app/server.js &
  echo "Waiting 30 seconds and trying again..."
  sleep 30
  pkill chromium
fi
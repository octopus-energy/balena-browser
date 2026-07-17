#!/usr/bin/env bash

function start_chromium() {
    cage -- /usr/src/app/startcage.sh
}

# translate old style transform values into degree rotations
case $ROTATE_DISPLAY in
    right)
        ROTATE_DISPLAY="270";;
    left)
        ROTATE_DISPLAY="90";;
    inverted)
        ROTATE_DISPLAY="180";;
esac

# set the device tag directly in the loading html in case the extension
# doesn't load
sed -i "s/unconfigured/$BALENA_APP_NAME\/$BALENA_DEVICE_NAME_AT_INIT/g" /home/chromium/loading.html

# Always use Chromium - video is now handled via HTML5 video in the extension
echo "Launching Chromium"
start_chromium
#!/usr/bin/env bash

if [[ -z "$WINDOW_SIZE" ]]; then
  # detect the window size from the framebuffer file
  echo "Detecting window size from framebuffer"
  export WINDOW_SIZE=$( cat /sys/class/graphics/fb0/virtual_size )
  echo "Window size detected as $WINDOW_SIZE"
else
  echo "Window size set by environment variable to $WINDOW_SIZE"
fi

# translate old style transform values into degree rotations
case $ROTATE_DISPLAY in
    left)
        ROTATE_DISPLAY="270";;
    right)
        ROTATE_DISPLAY="90";;
    inverted)
        ROTATE_DISPLAY="180";;
esac


IFS='\n'
SCREENS=$(wlr-randr --json | jq -r '.[].name')
unset IFS

if [ -z "${ROTATE_DISPLAY}" ]; then ROTATE_DISPLAY="normal"; fi

for SCREEN in "${SCREENS[@]}"; do
    wlr-randr --output "${SCREEN}" --scale "${DISPLAY_SCALE}" --transform "${ROTATE_DISPLAY}"
done

# these two lines remove the "restore pages" popup on chromium. 
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' /data/chromium/'Local State' > /dev/null 2>&1 || true 
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]\+"/"exit_type":"Normal"/' /data/chromium/Default/Preferences > /dev/null 2>&1 || true 

# Set chromium version into an EnVar for later
export VERSION=`chromium --version`
echo "Installed browser version: $VERSION"

node /usr/src/app/server.js
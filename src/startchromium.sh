#!/usr/bin/env bash

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
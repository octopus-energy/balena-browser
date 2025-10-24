#!/bin/bash

# these two lines remove the "restore pages" popup on chromium. 
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' /data/chromium/'Local State' > /dev/null 2>&1 || true 
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]\+"/"exit_type":"Normal"/' /data/chromium/Default/Preferences > /dev/null 2>&1 || true 

# Set chromium version into an EnVar for later
export VERSION=`chromium --version`
echo "Installed browser version: $VERSION"

cat >/home/chromium/display-hotplug.sh <<EOL
#!/bin/bash

sleep 5

export XDG_RUNTIME_DIR="/tmp/\$(id -u chromium)-runtime-dir"

# get the names of connected screens and store them in an array
IFS=$'\n'
SCREENS=\$(wlr-randr --json | jq -r '.[].name')
unset IFS


# set the screen rotation to normal if ROTATE_DISPLAY is unset
if [ -z "${ROTATE_DISPLAY}" ]; then ROTATE_DISPLAY="normal"; fi

# set the correct scale & transformation for each display
for SCREEN in "\${SCREENS[@]}"; do
    wlr-randr --output "\${SCREEN}" --scale "${DISPLAY_SCALE}" --transform "${ROTATE_DISPLAY}"
done
EOL

chmod +x /home/chromium/display-hotplug.sh

/home/chromium/display-hotplug.sh

node /usr/src/app/server.js
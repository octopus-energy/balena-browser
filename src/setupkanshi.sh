#!/bin/bash

regex="^[^-]+-(.+)$"

mkdir -p ~/.config/kanshi

for f in /sys/class/drm/*; do
    if [[ $f =~ $regex ]]; then
        name="${BASH_REMATCH[1]}"
        cat >> ~/.config/kanshi/config <<EOL
profile {
	output ${name} enable scale ${DISPLAY_SCALE} transform ${ROTATE_DISPLAY}
}
EOL
    fi
done

kanshi
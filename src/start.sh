#!/usr/bin/env bash

service seatd start

# this allows chromium sandbox to run, see https://github.com/balena-os/meta-balena/issues/2319
sysctl -w user.max_user_namespaces=10000

# Run balena base image entrypoint script
/usr/src/app/entry.sh echo "Running balena base image entrypoint..."

export DBUS_SYSTEM_BUS_ADDRESS=unix:path=/host/run/dbus/system_bus_socket

# this uses the legacy DRM interface. explained here: https://github.com/swaywm/sway/issues/7519
# without this, we get errors like this frequently: [backend/drm/atomic.c:79] connector HDMI-A-1: Atomic commit failed: Device or resource busy
export WLR_DRM_NO_ATOMIC=1

echo "balenaLabs browser version: $(<VERSION)"

# this stops the CPU performance scaling down
echo "Setting CPU Scaling Governor to 'performance'"
echo 'performance' > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 

# check if display number envar was set
if [[ -z "$DISPLAY_NUM" ]]
  then
    export DISPLAY_NUM=0
fi

# If the vcgencmd is supported (i.e. RPi device) - check enough GPU memory is allocated
if command -v vcgencmd &> /dev/null
then
	echo "Checking GPU memory"
    if [ "$(vcgencmd get_mem gpu | grep -o '[0-9]\+')" -lt 128 ]
	then
	echo -e "\033[91mWARNING: GPU MEMORY TOO LOW"
	fi
fi

# set up the user data area
mkdir -p /data/chromium
chown -R chromium:chromium /data
rm -f /data/chromium/SingletonLock

if [ -z "$XDG_RUNTIME_DIR" ]; then
    XDG_RUNTIME_DIR="/tmp/$(id -u chromium)-runtime-dir"

    mkdir -pm 0700 "$XDG_RUNTIME_DIR"
    chown -R chromium:chromium "$XDG_RUNTIME_DIR"
    export XDG_RUNTIME_DIR
fi

# enable hotplugging of input devices
if which udevadm > /dev/null; then
  set +e # Disable exit on error
  udevadm control --reload-rules
  service udev restart
  udevadm trigger
  set -e # Re-enable exit on error
fi

# tell plymouth (splash screen) to quit so that wayland can become drm master
# https://forums.balena.io/t/plymouthd-does-not-quit-and-prevents-gui-apps-from-rendering/372310
dbus-send \
--system \
--dest=org.freedesktop.systemd1 \
--type=method_call \
/org/freedesktop/systemd1 org.freedesktop.systemd1.Manager.StartUnit \
string:"plymouth-quit.service" string:"replace"

# we can't maintain the environment with su, because we are logging in to a new session
# so we need to manually pass in the environment variables to maintain, in a whitelist
# This gets the current environment, as a comma-separated string
environment=$(env | grep -v -w '_' | awk -F= '{ st = index($0,"=");print substr($1,0,st) ","}' | tr -d "\n")
# remove the last comma
environment="${environment::-1}"


# launch Chromium and whitelist the enVars so that they pass through to the su session
su -w "$environment" -c "/usr/src/app/userstart.sh" - chromium
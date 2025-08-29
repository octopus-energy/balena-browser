# balena-labs-projects/browser

Provides a hardware accelerated web browser to present internal and external URLs on a connected display.
The `browser` block is a docker image that runs a [Chromium](https://www.chromium.org/Home) browser via Weston, the reference Wayland compositor, optimized for balenaOS.

---
## Features

- Chromium browser optimized for device arch
- Hardware video acceleration (if enabled)
- Optional KIOSK mode
- Chromium remote debugging port
- Displays an on screen tag  with the device name
---

## Usage

#### docker-compose file
To use this image, create a container in your `docker-compose.yml` file as shown below:

```yaml
version: '2'

volumes:
  settings:                          # Only required if using PERSISTENT flag (see below)

services:

  browser:
    image: bh.cr/balenalabs/browser-<arch> # where <arch> is one of aarch64, arm32 or amd64
    privileged: true # required for UDEV to find plugged in peripherals such as a USB mouse
    ports:
        - '5011' # management API (optional)
        - '35173' # Chromium debugging port (optional)
    volumes:
      - 'settings:/data' # Only required if using PERSISTENT flag (see below)
```

To pin to a specific [version](CHANGELOG.md) of this block use:

```yaml
services:
  browser:
    image: bh.cr/balenalabs/browser-<arch>/<version>
    privileged: true # required for UDEV to find plugged in peripherals such as a USB mouse
    ports:
        - '5011' # management API (optional)
        - '35173' # Chromium debugging port (optional)
    volumes:
      - 'settings:/data' # Only required if using PERSISTENT flag (see below)
```

See [here](https://github.com/balena-io/open-balena-registry-proxy#usage) for more details about how to use blocks hosted in balenaCloud.

---

### Environment variables

The following environment variables allow configuration of the `browser` block:

| Environment variable | Options | Default | Description |
| --- | --- | --- | --- |
|`LAUNCH_URL`|`http` or `https` URL|N\A|Web page to display|
|`ROTATE_SCHEDULE`|cron expression or `0` to disable|`0`|cron expression to schedule the next LAUNCH_URL in the comma separated list|
|`REFRESH_SCHEDULE`|cron expression or `0` to disable|`0`|cron expression to schedule page refreshes|
|`DISPLAY_NUM`|`n`|0|Display number to use|
|`LOCAL_HTTP_DELAY`|Number (seconds)|0|Number of seconds to wait for a local HTTP service to start before trying to detect it|
|`KIOSK`|`0`, `1`|`0`|Run in kiosk mode with no menus or status bars. <br/> `0` = off, `1` = on|
|`FLAGS`|[many!](https://peter.sh/experiments/chromium-command-line-switches/)|N/A|**Replaces** the flags chromium is started with. Enter a space (\' \') separated list of flags (e.g. `--noerrdialogs --disable-session-crashed-bubble`) <br/> **Use with caution!**|
|`EXTRA_FLAGS`|[many!](https://peter.sh/experiments/chromium-command-line-switches/)|N/A|Adds **additional** flags chromium is started with. Enter a space (\' \') separated list of flags (e.g. `--audio-buffer-size=2048 --audio-output-channels=8`)|
|`PERSISTENT`|`0`, `1`|`0`|Enables/disables user profile data being stored on the device. **Note: you'll need to create a settings volume. See example above** <br/> `0` = off, `1` = on|
|`ROTATE_DISPLAY`|`normal`, `90`, `180`, `270`|`normal`|Rotates the display|
|`ENABLE_GPU`|`0`, `1`|0|Enables the GPU rendering. Necessary for Pi3B+ to display YouTube videos. <br/> `0` = off, `1` = on|
|`API_PORT`|port number|5011|Specifies the port number the API runs on|
|`REMOTE_DEBUG_PORT`|port number|35173|Specifies the port number the chrome remote debugger runs on|
|`AUTO_REFRESH`|interval|0 (disabled)|Specifies the number of seconds before the page automatically refreshes|
|`OSD_FONT_FAMILY`|css font family|helvetica|Specifies the value used in the `font-family` property for the OSD device name tag|
|`OSD_FONT_SIZE`|css size|18px|Specifies the value used in the `font-size` css property for the OSD device name tag|
|`OSD_CSS`|object|`{}`|Object holding key-value pairs for css property names and values to be applied to the OSD device name tag|
|`SHOW_DEVICE_TAG`|`0`, `1`|`1`|Used to hide the device tag. Useful for full screen video playback|

---

## Choosing what to display
If you want the `browser` to display a website, you can set the `LAUNCH_URL` as noted above.

## Choosing audio output device
By default the `browser` block will output audio via HDMI. If you want to route audio through a different interface you can do it with the help of the [`audio` block]((https://github.com/balena-labs-projects/audio)). The `browser` block is pre-configured to use it if present so you only need to add it to your `docker-compose.yml` file and then use `AUDIO_OUTPUT` environment variable to select the desired output. Check out the `audio` block [documentation](https://github.com/balena-labs-projects/audio#environment-variables) to learn more about it.

In this example we add the `audio` block and route the `browser` audio to the Raspberry Pi headphone jack:

```yaml
services:
  browser:
    image: bh.cr/balenalabs/browser-<arch>
  audio:
    image: bh.cr/balenalabs/audio-<arch>
    privileged: true
    ports:
      - 4317:4317
    environment:
      AUDIO_OUTPUT: RPI_HEADPHONES
```

**Note**: The `browser` block expects the `audio` block to be named as such. If you change it's service name you'll need to override the `PULSE_SERVER` environment variable value to match it in the `browser` dockerfile. For example add `ENV PULSE_SERVER=tcp:not-audio:4317`.

---

## Supported devices
The `browser` block has been tested to work on the following devices:

| Device Type  | Status |
| ------------- | ------------- |
| Raspberry Pi 3b+ | ✔ |
| Raspberry Pi 3b+ (64-bit OS) | ✔ |
| balena Fin | ✔ |
| Raspberry Pi 4 | ✔ |
| Intel NUC | ✔ |
| Generic AMD64 | ✔ |

---

## Troubleshooting
This section provides some guidance for common issues encountered:

#### Black border on HDMI display
Thanks to 1980's CRT televisions, manufacturers had to invent a method for cutting off the edges of a picture to ensure the "important" bits were displayed nicely on the screen. This is called `overscan` and there's a good article on it [here](https://www.howtogeek.com/252193/hdtv-overscan-what-it-is-and-why-you-should-probably-turn-it-off/).
If, when you plug one of the supported devices into your HDMI screen, you find black borders around the picture, you need to disable overscan. For the device this can be achieved by setting a [Device Configuration variable](https://www.balena.io/docs/learn/manage/configuration/#:~:text=Define%20fleet%2Dwide%3A-,Managing%20device%20configuration%20variables,of%20the%20device%20configuration%20variable.) called `BALENA_HOST_CONFIG_disable_overscan` and setting the value to `1`:

![overscan-setting](https://i.ibb.co/sCQ8Dwy/Capture.jpg)

You may also need to turn it off on the screen itself (check your device instructions for details).

#### Partial/strange display output
Occasionally users report weird things are happening with their display output like:
* Only a portion of the browser screen appears on their display
* The screen is displaying skewed or fragmented
* Colors have changed dramatically

Here are some things to try:
* Setting the WINDOW_SIZE manually to your display's resolution (e.g. `1980,1080`) - the display may be mis-reporting it's resolution to the device
* Increase the memory being allocated to the GPU with the Device Configuration tab on the dashboard, or via [configuration variable](https://www.balena.io/docs/learn/manage/configuration/) - for large displays the device may need to allocate more memory to displaying the output



#!/usr/bin/env bash
# Download yt-dlp for YouTube videos to play
mkdir -p /data/mpv
chown chromium:chromium /data/mpv

YT_DLP=/usr/bin/youtube-dl

curl -m 5 -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o $YT_DLP | echo 0
chmod a+rx $YT_DLP | echo 0 # Make executable
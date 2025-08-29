import hashlib
import os
from pathlib import Path
import json

extensions = {}

script_dir = Path(__file__).parent.absolute()

for file in os.listdir(script_dir):
    if not os.path.isdir('/'.join([str(script_dir), file])):
        continue
    m = hashlib.sha256()
    m.update(bytes(f"/usr/share/chromium/extensions/{file}".encode('utf-8')))
    extensions[file] = ''.join([chr(int(i, base=16) + ord('a')) for i in m.hexdigest()][:32])

print(
    json.dumps(extensions, indent=4)
)
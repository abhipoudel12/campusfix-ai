"""One approved future API submission; never run during deployment verification."""

import base64
import json
import os
import urllib.error
import urllib.request


api_url = os.environ["CAMPUSFIX_API_URL"].rstrip("/")
if not api_url.startswith("https://"):
    raise SystemExit("CAMPUSFIX_API_URL must be an HTTPS API endpoint")

# Valid 1x1 PNG. It checks the inference path, not the model's visual quality.
image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lV8AAAAASUVORK5CYII="
assert base64.b64decode(image_base64)
payload = {
    "imageBase64": image_base64,
    "mimeType": "image/png",
    "location": "Synthetic Test Campus / Hallway A",
    "notes": "Synthetic integration test. No real campus issue or personal details.",
}
request = urllib.request.Request(
    f"{api_url}/reports",
    data=json.dumps(payload).encode("utf-8"),
    headers={"content-type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(request, timeout=35) as response:
        result = json.load(response)
        print(json.dumps({
            "http_status": response.status,
            "duplicate": result.get("duplicate"),
            "report_id": result.get("report", {}).get("id"),
            "score": result.get("report", {}).get("score"),
        }))
except urllib.error.HTTPError as error:
    print(json.dumps({"http_status": error.code, "error": "API rejected the smoke test"}))

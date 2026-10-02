"""Review a CampusFix photo test locally; send it only with --execute after approval."""

import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time


PROFILE = "campusfix-ai"
REGION = "us-east-1"
STACK = "campusfix-backend"
LOCATION = "Synthetic Test Campus / North Walkway"
NOTES = "Synthetic test: raised, broken sidewalk slabs may be a trip hazard. No real campus or person is identified."
PNG_SIGNATURE = bytes.fromhex("89504e470d0a1a0a")
SCORE_BASE = {"Low": 25, "Medium": 50, "High": 70}


def photo_bytes(path):
    """Keep only critical PNG chunks so EXIF and text metadata are not uploaded."""
    source = path.read_bytes()
    if not source.startswith(PNG_SIGNATURE):
        raise ValueError("Expected a PNG image")
    offset = len(PNG_SIGNATURE)
    clean = bytearray(PNG_SIGNATURE)
    kinds = []
    while offset + 12 <= len(source):
        length = int.from_bytes(source[offset:offset + 4], "big")
        end = offset + 12 + length
        if end > len(source):
            raise ValueError("Malformed PNG chunk")
        kind = source[offset + 4:offset + 8]
        kinds.append(kind)
        if kind in (b"IHDR", b"PLTE", b"IDAT", b"IEND") or kind == b"tRNS":
            clean.extend(source[offset:end])
        offset = end
        if kind == b"IEND":
            break
    if offset != len(source) or not kinds or kinds[0] != b"IHDR" or kinds[-1] != b"IEND" or b"IDAT" not in kinds:
        raise ValueError("Incomplete PNG")
    width = int.from_bytes(source[16:20], "big")
    height = int.from_bytes(source[20:24], "big")
    if not (1 <= width <= 8000 and 1 <= height <= 8000 and 0 < len(clean) <= 3 * 1024 * 1024):
        raise ValueError("Image exceeds API dimensions or byte limit")
    return bytes(clean), width, height, len(source)


def aws(*args):
    result = subprocess.run(
        ["aws", "--profile", PROFILE, "--region", REGION, *args, "--output", "json"],
        capture_output=True, text=True, check=False,
    )
    if result.returncode:
        raise RuntimeError("AWS read failed: " + " ".join(args[:2]))
    return json.loads(result.stdout) if result.stdout.strip() else {}


def counter(table, day):
    item = aws(
        "dynamodb", "get-item", "--table-name", table,
        "--key", json.dumps({"id": {"S": "quota#" + day}}),
        "--projection-expression", "used", "--consistent-read",
    ).get("Item", {})
    return int(item.get("used", {}).get("N", "0"))


def api_request(url, method, path, body=None):
    # curl has no automatic retries here. Keep photo bytes in memory and off stdout.
    cmd = [
        "curl", "--silent", "--show-error", "--retry", "0", "--max-time", "35",
        "--request", method, "--header", "Content-Type: application/json",
        "--write-out", "\n%{http_code}",
    ]
    if body is not None:
        cmd += ["--data-binary", "@-"]
    cmd.append(url + path)
    result = subprocess.run(cmd, input=json.dumps(body) if body is not None else None,
                            capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError("HTTP transport failed; submission state is unknown, so no retry will run")
    try:
        text, code = result.stdout.rsplit("\n", 1)
        return int(code), json.loads(text)
    except (ValueError, json.JSONDecodeError) as error:
        raise RuntimeError("Unexpected API response; no retry will run") from error


def expected_score(report):
    base = SCORE_BASE[report["severity"]]
    return min(100, base + (15 if report["hazard"] else 0) + (5 if report["recurring"] else 0))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--execute", action="store_true", help="Send the approved first and duplicate POST requests")
    args = parser.parse_args()
    image, width, height, source_size = photo_bytes(args.image)
    payload = {
        "imageBase64": base64.b64encode(image).decode("ascii"),
        "mimeType": "image/png",
        "location": LOCATION,
        "notes": NOTES,
    }
    print(json.dumps({
        "image_size_bytes": source_size, "uploaded_size_bytes": len(image),
        "dimensions": [width, height], "metadata_stripped": source_size != len(image),
        "request": "POST /reports", "mime_type": "image/png",
        "location": LOCATION, "notes": NOTES, "http_retries": 0,
        "will_execute": args.execute,
    }))
    if not args.execute:
        return

    identity = aws("sts", "get-caller-identity")
    plan = aws("freetier", "get-account-plan-state")
    credits = plan.get("accountPlanRemainingCredits") or {}
    if (identity.get("Account") != plan.get("accountId") or plan.get("accountPlanType") != "FREE"
            or plan.get("accountPlanStatus") != "ACTIVE" or credits.get("unit") != "USD"
            or not isinstance(credits.get("amount"), (int, float)) or credits["amount"] <= 0):
        raise RuntimeError("Free Plan preflight failed; no photo request sent")
    stack = aws("cloudformation", "describe-stacks", "--stack-name", STACK)["Stacks"][0]
    if stack["StackStatus"] not in ("CREATE_COMPLETE", "UPDATE_COMPLETE"):
        raise RuntimeError("Backend is not ready; no photo request sent")
    outputs = {item["OutputKey"]: item["OutputValue"] for item in stack.get("Outputs", [])}
    url = outputs.get("ApiUrl", "")
    table = outputs.get("ReportsTableName", "")
    if not (url.startswith("https://") and table):
        raise RuntimeError("Backend outputs are missing; no photo request sent")
    now = datetime.now(timezone.utc)
    if now.hour == 23 and now.minute >= 57:
        raise RuntimeError("Too close to the UTC counter reset; no photo request sent")
    day = now.date().isoformat()
    before = counter(table, day)
    print(json.dumps({"preflight": "FREE/ACTIVE", "credits_remaining_usd": credits["amount"],
                      "counter_before": before, "counter_day_utc": day}), flush=True)

    first_status, first = api_request(url, "POST", "/reports", payload)
    if first_status != 201 or first.get("duplicate") is not False:
        raise RuntimeError(f"First POST returned HTTP {first_status}; no second POST will run")
    report = first.get("report") or {}
    normalized_location = " ".join(LOCATION.lower().split())
    expected_id = hashlib.sha256(image + b"\0" + normalized_location.encode()).hexdigest()
    if report.get("id") != expected_id or report.get("location") != LOCATION or report.get("notes") != NOTES:
        raise RuntimeError("First report identity or inputs differ; no second POST will run")
    if report.get("createdAt", "")[:10] != day:
        raise RuntimeError("UTC counter day changed; no second POST will run")
    if report.get("score") != expected_score(report) or report.get("status") != "Open":
        raise RuntimeError("Score or status mismatch; no second POST will run")
    after_first = counter(table, day)
    if after_first != before + 1:
        raise RuntimeError("Inference counter did not rise by one; no second POST will run")
    print(json.dumps({"first_http_status": first_status, "duplicate": False,
                      "analysis": {key: report.get(key) for key in
                                   ("title", "category", "severity", "hazard", "recurring", "description", "action")},
                      "score": report["score"], "counter_after_first": after_first}), flush=True)

    listed_status, listed = api_request(url, "GET", "/reports")
    if listed_status != 200 or not any(item.get("id") == expected_id and item.get("score") == report["score"]
                                       for item in listed.get("reports", [])):
        raise RuntimeError("Report not found on first GET page; no second POST will run")
    print(json.dumps({"list_http_status": listed_status, "report_visible": True}), flush=True)
    time.sleep(2)

    second_status, second = api_request(url, "POST", "/reports", payload)
    after_second = counter(table, day)
    if second_status != 200 or second.get("duplicate") is not True or (second.get("report") or {}).get("id") != expected_id:
        raise RuntimeError("Duplicate response failed verification")
    if after_second != after_first:
        raise RuntimeError("Inference counter changed after duplicate; no second-inference claim can be made")
    print(json.dumps({"duplicate_http_status": second_status, "duplicate": True,
                      "same_report": True, "counter_after_duplicate": after_second,
                      "second_inference_avoided": True}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        print("STOP:", error, file=sys.stderr)
        sys.exit(1)

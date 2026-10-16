"""Generate website WebP assets from verified source PNGs (requires Pillow).

Run after download-avatars.mjs; no network access or personal data involved.
Original PNGs and their source manifest are preserved for attribution/README.
"""
import hashlib
import io
import json
from pathlib import Path

from PIL import Image, features

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY = ROOT / "public" / "avatars"
QUALITY = 85


def main():
    if not features.check("webp"):
        raise RuntimeError("This Pillow installation does not support WebP")
    source = json.loads((DIRECTORY / "avatar-manifest.json").read_text("utf-8"))
    operators = json.loads((ROOT / "src/data/operators.json").read_text("utf-8"))["operators"]
    ids = {operator["id"] for operator in operators if operator["rarity"] == 6}
    records = {entry["id"]: entry for entry in source["files"]}
    if ids != records.keys():
        raise RuntimeError("Source manifest must cover exactly the current six-star list")
    output = DIRECTORY / "webp"
    output.mkdir(exist_ok=True)
    entries = []
    paths = {}
    for operator_id in sorted(ids):
        record = records[operator_id]
        raw = (DIRECTORY / f"{operator_id}.png").read_bytes()
        if hashlib.sha256(raw).hexdigest() != record["sha256"]:
            raise RuntimeError(f"Source hash mismatch: {operator_id}")
        with Image.open(io.BytesIO(raw)) as original:
            image = original.convert("RGBA")
        buffer = io.BytesIO()
        image.save(buffer, format="WEBP", quality=QUALITY, method=6, exact=True)
        encoded = buffer.getvalue()
        checksum = hashlib.sha256(encoded).hexdigest()
        filename = f"{operator_id}.{checksum[:12]}.webp"
        with Image.open(io.BytesIO(encoded)) as decoded:
            if decoded.size != image.size:
                raise RuntimeError(f"Dimensions changed: {operator_id}")
            if decoded.convert("RGBA").getchannel("A").tobytes() != image.getchannel("A").tobytes():
                raise RuntimeError(f"Transparency changed: {operator_id}")
        (output / filename).write_bytes(encoded)
        paths[operator_id] = f"avatars/webp/{filename}"
        entries.append({"id": operator_id, "path": paths[operator_id], "bytes": len(encoded),
                        "width": image.width, "height": image.height, "sha256": checksum,
                        "sourceSha256": record["sha256"]})
    manifest = {"sourceRevision": source["revision"], "format": "webp", "quality": QUALITY,
                "method": 6, "originalBytes": sum(records[key]["bytes"] for key in ids),
                "optimizedBytes": sum(entry["bytes"] for entry in entries), "files": entries}
    (DIRECTORY / "webp-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", "utf-8")
    (ROOT / "src/data/avatarImages.json").write_text(json.dumps(paths, indent=2) + "\n", "utf-8")
    # Only remove obsolete generated WebP files in this fixed output directory.
    active = {Path(entry["path"]).name for entry in entries}
    for candidate in output.glob("char_*.webp"):
        if candidate.name not in active:
            candidate.unlink()
    print(json.dumps({"count": len(entries), "pngBytes": manifest["originalBytes"],
                      "webpBytes": manifest["optimizedBytes"],
                      "savedPercent": round(100 * (1 - manifest["optimizedBytes"] / manifest["originalBytes"]), 1)}))


if __name__ == "__main__":
    main()

"""Fetch the pinned, licensed full model and verify its SHA-256."""

import argparse
import hashlib
from pathlib import Path
from urllib.request import urlopen

URL = (
    "https://raw.githubusercontent.com/openBIMstandards/Archive-DataSetSchependomlaan/"
    "e6971d897b60f04ea28b4e3f2acf80d05f269197/Design%20model%20IFC/IFC%20Schependomlaan.ifc"
)
DIGEST = "2c3565ca1904f2aa61adab92024cf3755b2c5b21a498144d3094d7cb58cebec7"
SIZE = 49_286_967


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("The output file already exists.")
    with urlopen(URL, timeout=60) as response:
        data = response.read(SIZE + 1)
    if len(data) != SIZE or hashlib.sha256(data).hexdigest() != DIGEST:
        raise SystemExit("The model bytes did not match the pinned IFC.")
    with args.output.open("xb") as out:
        out.write(data)
    print(f"Wrote {args.output} ({SIZE:,} bytes)")


if __name__ == "__main__":
    main()

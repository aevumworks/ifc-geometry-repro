"""Command-line interface for inspecting, capturing, and replaying cases."""

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path

from .case import capture, dump, load_json, replay, sha256
from .engines import AXES, get_product, meshes, open_model
from .probe import Probe, disagree, initial_probe, measure
from .report import write_report


def cli():
    parser = argparse.ArgumentParser(prog="python -m ifc_repro", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    listing = commands.add_parser("list", help="list represented elements")
    listing.add_argument("model", type=Path)
    listing.add_argument("--class", dest="ifc_class", default="IfcWall")

    inspect = commands.add_parser(
        "inspect", help="measure a ray and optionally create a pickable report"
    )
    inspect.add_argument("model", type=Path)
    inspect.add_argument("guid")
    inspect.add_argument("--axis", choices=AXES, default="y")
    inspect.add_argument("--at", type=float, nargs=2, metavar=("U", "V"))
    inspect.add_argument("--expect", choices=("clear", "blocked"))
    inspect.add_argument("--html", type=Path)
    inspect.add_argument("--probe-out", type=Path)

    store = commands.add_parser(
        "capture", help="write a reduced reproducer from a probe"
    )
    store.add_argument("model", type=Path)
    store.add_argument("probe", type=Path)
    store.add_argument("output", type=Path)

    run = commands.add_parser("replay", help="rerun a capture with the locked engines")
    run.add_argument("bundle", type=Path)
    return parser


def main():
    args = cli().parse_args()
    try:
        if args.command == "list":
            products = open_model(args.model).by_type(args.ifc_class)
            result = [
                {"guid": p.GlobalId, "class": p.is_a(), "name": p.Name}
                for p in products
                if getattr(p, "Representation", None)
            ]
        elif args.command == "inspect":
            digest = sha256(args.model)
            product = get_product(open_model(args.model), args.guid)
            geometry = meshes(args.model, product)
            probe = initial_probe(geometry, args.guid, args.axis, digest, args.at)
            probe = replace(probe, expected=args.expect)
            hits = measure(geometry, probe)
            if sha256(args.model) != digest:
                raise ValueError("The source IFC changed during inspection. Try again.")
            paths = [path.resolve() for path in (args.html, args.probe_out) if path]
            if len(set(paths)) != len(paths) or any(path.exists() for path in paths):
                raise ValueError("Choose distinct output paths that do not exist.")
            if args.html:
                write_report(args.html, geometry, probe)
            if args.probe_out:
                dump(args.probe_out, probe.as_json())
            result = {
                "probe": probe.as_json(),
                "hits": hits,
                "different": disagree(hits, probe.tolerance),
            }
            if probe.expected:
                result["matches_expected"] = {
                    name: bool(positions) == (probe.expected == "blocked")
                    for name, positions in hits.items()
                }
        elif args.command == "capture":
            result = capture(args.model, Probe(**load_json(args.probe)), args.output)
        else:
            result = replay(args.bundle)
        print(json.dumps(result, indent=2, ensure_ascii=True, allow_nan=False))
        return 1 if args.command == "replay" and not result["reproduced"] else 0
    except (ValueError, OSError, RuntimeError, KeyError, TypeError) as error:
        print(f"ifc-repro: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

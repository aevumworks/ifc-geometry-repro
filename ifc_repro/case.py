"""Capture and replay a discrepancy with a checked, reduced IFC subset."""

import hashlib
import json
import shutil
import tempfile
from pathlib import Path

from ifcpatch.recipes.ExtractElements import Patcher
from ifcopenshell.util.element import get_container
from ifcopenshell.util.unit import calculate_unit_scale

from .engines import Unavailable, get_product, meshes, open_model, versions
from .probe import Probe, disagree, measure, same_measurement
from .report import write_report


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def dump(path, value):
    with path.open("w", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, indent=2, allow_nan=False)
        stream.write("\n")


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _relations(product):
    return getattr(product, "HasOpenings", ()) or ()


def _required_roots(product):
    return {
        fill.RelatedBuildingElement.GlobalId
        for rel in _relations(product)
        for fill in rel.RelatedOpeningElement.HasFillings or ()
    } | {product.GlobalId}


def _opening_signature(product):
    return sorted(
        (
            rel.RelatedOpeningElement.GlobalId,
            sorted(
                fill.RelatedBuildingElement.GlobalId
                for fill in rel.RelatedOpeningElement.HasFillings or ()
            ),
        )
        for rel in _relations(product)
    )


def _candidate_groups(product):
    required = _required_roots(product)
    container = get_container(product)
    if container:
        context = {
            item.GlobalId
            for relationship in container.ContainsElements or ()
            for item in relationship.RelatedElements
            if item.is_a("IfcElement")
        }
        if context - required:
            yield "spatial container", sorted(context | required)
    yield "element and opening dependencies", sorted(required)


def _extract(model, product, guids):
    patcher = Patcher(model, query=", ".join(guids))
    patcher.patch()
    candidate = patcher.get_output()
    for rel in _relations(product):
        original = rel.RelatedOpeningElement
        if not original.HasFillings:
            continue
        opening = candidate.by_guid(original.GlobalId)
        existing = {item.GlobalId for item in opening.HasFillings or ()}
        for fill in original.HasFillings:
            if fill.GlobalId in existing:
                continue
            element = candidate.by_guid(fill.RelatedBuildingElement.GlobalId)
            candidate.create_entity(
                "IfcRelFillsElement",
                GlobalId=fill.GlobalId,
                OwnerHistory=opening.OwnerHistory,
                Name=fill.Name,
                Description=fill.Description,
                RelatingOpeningElement=opening,
                RelatedBuildingElement=element,
            )
    return candidate


def capture(source, probe, output):
    if output.exists():
        raise ValueError(f"Capture destination already exists: {output}")
    source_hash = sha256(source)
    if probe.source_sha256 and probe.source_sha256 != source_hash:
        raise ValueError("Probe SHA-256 does not match the input IFC.")
    model = open_model(source)
    product = get_product(model, probe.guid)
    baseline_meshes = meshes(source, product)
    baseline = measure(baseline_meshes, probe)
    if not disagree(baseline, probe.tolerance):
        raise ValueError(
            "The engines agree at this point. Choose a point with a discrepancy."
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    baseline_size = source.stat().st_size
    source_count = len(model.by_type("IfcElement"))
    opening_signature = _opening_signature(product)
    trace = []
    with tempfile.TemporaryDirectory(prefix="ifc-repro-", dir=output.parent) as temp:
        work = Path(temp)
        bundle = work / "bundle"
        bundle.mkdir()
        candidate_path = work / "candidate.ifc"
        best_path = bundle / "model.ifc"
        best_size = baseline_size
        best_count = source_count
        for label, guids in _candidate_groups(product):
            try:
                candidate = _extract(model, product, guids)
                candidate.write(candidate_path)
                # Give both engines the same newly serialized model.
                candidate = open_model(candidate_path)
                reduced = get_product(candidate, probe.guid)
                if candidate.schema_identifier != model.schema_identifier:
                    raise Unavailable("Schema changed.")
                if calculate_unit_scale(candidate) != calculate_unit_scale(model):
                    raise Unavailable("Length units changed.")
                if _opening_signature(reduced) != opening_signature:
                    raise Unavailable("Opening or filling relationships changed.")
                candidate_count = len(candidate.by_type("IfcElement"))
                size = candidate_path.stat().st_size
                if size >= best_size or candidate_count >= best_count:
                    raise Unavailable("Candidate did not produce a smaller case.")
                candidate_meshes = meshes(candidate_path, reduced)
                hits = measure(candidate_meshes, probe)
                if not same_measurement(baseline, hits, probe.tolerance):
                    raise Unavailable("The original per-engine crossings changed.")
            except (RuntimeError, Unavailable) as error:
                trace.append({"step": label, "accepted": False, "reason": str(error)})
                continue
            trace.append(
                {
                    "step": label,
                    "accepted": True,
                    "elements": candidate_count,
                    "bytes": size,
                }
            )
            shutil.copyfile(candidate_path, best_path)
            best_size = size
            best_count = candidate_count
            best_meshes = candidate_meshes
            best_hits = hits

        if not best_path.exists():
            reasons = "; ".join(f"{item['step']}: {item['reason']}" for item in trace)
            raise ValueError(f"No smaller IFC preserved this discrepancy. {reasons}")
        if sha256(source) != source_hash:
            raise ValueError("The source IFC changed during capture. Try again.")
        record = {
            "format": 1,
            "versions": versions(),
            "probe": probe.as_json(),
            "source_sha256": source_hash,
            "model_sha256": sha256(best_path),
            "original": {
                "elements": source_count,
                "bytes": baseline_size,
                "hits": baseline,
            },
            "reduced": {"elements": best_count, "bytes": best_size, "hits": best_hits},
            "trace": trace,
        }
        dump(bundle / "case.json", record)
        write_report(bundle / "report.html", best_meshes, probe, record)
        bundle.rename(output)
    return record


def replay(bundle):
    record = load_json(bundle / "case.json")
    if record["format"] != 1:
        raise ValueError("Unsupported reproduction bundle format.")
    if record["versions"] != versions():
        raise ValueError(
            f"Engine versions differ from the capture: {record['versions']}"
        )
    path = bundle / "model.ifc"
    if sha256(path) != record["model_sha256"]:
        raise ValueError("Reduced model SHA-256 does not match.")
    probe = Probe(**record["probe"])
    product = get_product(open_model(path), probe.guid)
    hits = measure(meshes(path, product), probe)
    reproduced = disagree(hits, probe.tolerance) and same_measurement(
        hits, record["original"]["hits"], probe.tolerance
    )
    return {"reproduced": reproduced, "hits": hits}

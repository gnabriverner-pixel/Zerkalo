#!/usr/bin/env python3
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs/evidence/g1c-phase1-blind-v2"
TARGETS = {f"T{index:03d}" for index in range(1, 31)}
CANDIDATES = {"A", "B", "C", "D", "E"}
FORBIDDEN_KEYS = {
    "case_id",
    "run_id",
    "myth_id",
    "hidden_context",
    "true_source",
    "decoys",
    "wrong_source_case_id",
    "expected",
    "plausibility",
    "model",
    "model_requested",
    "model_seen",
    "provider",
    "writer",
    "grader",
    "reveal",
    "provenance",
}
FORBIDDEN_TEXT = re.compile(
    r"G1C-S-\d+|g1c-synth|deepseek|gemini|gpt(?:-|_)|glm|claude|sonnet|opus|"
    r"provider|writer|grader|reveal|provenance",
    re.IGNORECASE,
)


def load_json(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def walk(value):
    if isinstance(value, dict):
        for key, item in value.items():
            assert key not in FORBIDDEN_KEYS, f"forbidden key: {key}"
            yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)
    elif isinstance(value, str):
        assert not FORBIDDEN_TEXT.search(value), f"forbidden text: {value[:120]}"


def main():
    myth_rows = [
        json.loads(line)
        for line in (DATA / "G1C_PHASE1_BLIND_V2_MYTHS.jsonl")
        .read_text(encoding="utf-8")
        .splitlines()
        if line.strip()
    ]
    identity = load_json("G1C_PHASE1_BLIND_V2_IDENTITY_MATCHING.json")
    counterfactuals = load_json("G1C_PHASE1_BLIND_V2_COUNTERFACTUALS.json")
    schema = load_json("G1C_PHASE1_BLIND_V2_RESULT_SCHEMA.json")

    assert len(myth_rows) == 30
    assert len(identity["candidate_sets"]) == 30
    assert len(counterfactuals["items"]) == 30
    assert {row["target_id"] for row in myth_rows} == TARGETS
    assert {row["target_id"] for row in identity["candidate_sets"]} == TARGETS
    assert {row["target_id"] for row in counterfactuals["items"]} == TARGETS

    myths = {row["target_id"]: row["myth"] for row in myth_rows}
    for item in identity["candidate_sets"]:
        labels = {candidate["candidate"] for candidate in item["candidates"]}
        assert labels == CANDIDATES
        assert item["target_id"] not in labels
        assert TARGETS.isdisjoint(labels)
        assert item["myth"] == myths[item["target_id"]]
        for candidate in item["candidates"]:
            assert set(candidate) == {"candidate", "answers"}
            assert set(candidate["answers"]) == {"q1", "q2", "q3", "q4"}
    for item in counterfactuals["items"]:
        assert item["myth"] == myths[item["target_id"]]
        assert set(item["wrong_answers"]) == {"q1", "q2", "q3", "q4"}

    for value in (myth_rows, identity, counterfactuals, schema):
        tuple(walk(value))

    rating = schema["$defs"]["rating"]
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert rating == {"type": "integer", "minimum": 1, "maximum": 6}

    tree = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", "HEAD"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    lowered = [path.lower() for path in tree]
    assert not any("sealed" in path or "mapping" in path for path in lowered)
    assert not any(path.endswith("g1c_phase1_blind_v2_mapping.json") for path in lowered)

    print("PASS: 30 targets; anonymous A-E candidates; 1-6 schema; forbidden metadata absent; sealed mapping absent from HEAD tree")


if __name__ == "__main__":
    main()

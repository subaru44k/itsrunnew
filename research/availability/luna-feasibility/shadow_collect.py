#!/usr/bin/env python3
"""Run a finite, reviewed-source availability shadow trial.

This module deliberately does not infer availability and does not call an AI
service.  It verifies the exact HTTPS sources and hashes listed in a reviewed
approval file, then copies only reviewed records whose date is inside the
requested finite window.  Everything else becomes ``unknown``.
"""

from __future__ import annotations

import argparse
from collections import OrderedDict
from copy import deepcopy
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any, Callable, Iterable, Mapping, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT_ROOT = SCRIPT_DIR / "local-state" / "shadow"
MAX_DAYS = 62
DEFAULT_DAYS = 31
MAX_SOURCE_BYTES = 10 * 1024 * 1024
FETCH_TIMEOUT_SECONDS = 20

STATUSES = frozenset({"available", "partially_available", "unavailable", "unknown"})
POSITIVE_STATUSES = frozenset({"available", "partially_available"})
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
HASH_PATTERN = re.compile(r"^[0-9a-fA-F]{64}$")
RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


class ApprovalError(ValueError):
    """Raised when an approval file does not satisfy the reviewed contract."""


class ShadowRunError(RuntimeError):
    """Raised for a run-level failure before a shadow result can be emitted."""


Fetcher = Callable[[str], bytes]


@dataclass(frozen=True)
class SourceFetch:
    """The one fresh fetch result cached for one run and one URL."""

    sha256: str | None
    error: str | None


def _require_keys(value: Mapping[str, Any], required: Iterable[str], label: str) -> None:
    required_set = set(required)
    missing = sorted(required_set - set(value))
    if missing:
        raise ApprovalError(f"{label} missing required field(s): {', '.join(missing)}")


def _require_string(value: Any, label: str, *, nonempty: bool = True) -> str:
    if not isinstance(value, str):
        raise ApprovalError(f"{label} must be a string")
    if nonempty and not value.strip():
        raise ApprovalError(f"{label} must not be empty")
    return value


def _parse_date(value: Any, label: str) -> date:
    text = _require_string(value, label)
    if not DATE_PATTERN.fullmatch(text):
        raise ApprovalError(f"{label} must use YYYY-MM-DD")
    try:
        return date.fromisoformat(text)
    except ValueError as error:
        raise ApprovalError(f"{label} is not a valid calendar date") from error


def _parse_time(value: Any, label: str) -> tuple[int, int]:
    text = _require_string(value, label)
    if not TIME_PATTERN.fullmatch(text):
        raise ApprovalError(f"{label} must use HH:MM")
    hour, minute = (int(part) for part in text.split(":"))
    return hour, minute


def _validate_url(value: Any, label: str) -> str:
    url = _require_string(value, label)
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https" or not parsed.netloc:
        raise ApprovalError(f"{label} must be an absolute HTTPS URL")
    if parsed.username or parsed.password:
        raise ApprovalError(f"{label} must not contain credentials")
    return url


def _validate_hash(value: Any, label: str) -> str:
    digest = _require_string(value, label)
    if not HASH_PATTERN.fullmatch(digest):
        raise ApprovalError(f"{label} must be a 64-character SHA-256 hex digest")
    return digest.lower()


def _validate_period(value: Any, label: str) -> dict[str, str | None]:
    if not isinstance(value, dict):
        raise ApprovalError(f"{label} must be an object")
    _require_keys(value, ("start", "end", "scope", "last_entry"), label)
    start = _require_string(value["start"], f"{label}.start")
    end = _require_string(value["end"], f"{label}.end")
    start_pair = _parse_time(start, f"{label}.start")
    end_pair = _parse_time(end, f"{label}.end")
    if start_pair >= end_pair:
        raise ApprovalError(f"{label}.start must be before {label}.end")
    last_entry = value["last_entry"]
    if last_entry is not None:
        last_entry = _require_string(last_entry, f"{label}.last_entry")
        last_entry_pair = _parse_time(last_entry, f"{label}.last_entry")
        if not (start_pair <= last_entry_pair <= end_pair):
            raise ApprovalError(f"{label}.last_entry must be within start and end")
    return {
        "start": start,
        "end": end,
        "scope": _require_string(value["scope"], f"{label}.scope"),
        "last_entry": last_entry,
    }


def _validate_evidence(value: Any, label: str) -> list[dict[str, str]]:
    if not isinstance(value, list):
        raise ApprovalError(f"{label} must be an array")
    result: list[dict[str, str]] = []
    for index, item in enumerate(value):
        item_label = f"{label}[{index}]"
        if not isinstance(item, dict):
            raise ApprovalError(f"{item_label} must be an object")
        _require_keys(item, ("source", "location", "quote_or_symbol"), item_label)
        result.append({
            "source": _require_string(item["source"], f"{item_label}.source"),
            "location": _require_string(item["location"], f"{item_label}.location"),
            "quote_or_symbol": _require_string(item["quote_or_symbol"], f"{item_label}.quote_or_symbol"),
        })
    return result


def _validate_record(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ApprovalError(f"{label} must be an object")
    _require_keys(value, ("date", "status", "periods", "conditions", "evidence", "unknown_reason"), label)
    record_date = _parse_date(value["date"], f"{label}.date")
    status = _require_string(value["status"], f"{label}.status")
    if status not in STATUSES:
        raise ApprovalError(f"{label}.status is not one of: {', '.join(sorted(STATUSES))}")
    periods_value = value["periods"]
    if not isinstance(periods_value, list):
        raise ApprovalError(f"{label}.periods must be an array")
    periods = [_validate_period(item, f"{label}.periods[{index}]") for index, item in enumerate(periods_value)]
    conditions_value = value["conditions"]
    if not isinstance(conditions_value, list) or any(not isinstance(item, str) for item in conditions_value):
        raise ApprovalError(f"{label}.conditions must be an array of strings")
    conditions = [item for item in conditions_value]
    evidence = _validate_evidence(value["evidence"], f"{label}.evidence")
    unknown_reason = value["unknown_reason"]
    if unknown_reason is not None:
        unknown_reason = _require_string(unknown_reason, f"{label}.unknown_reason")
    if status == "unknown":
        if periods:
            raise ApprovalError(f"{label}.unknown cannot contain periods")
        if not unknown_reason:
            raise ApprovalError(f"{label}.unknown requires unknown_reason")
    else:
        if unknown_reason is not None:
            raise ApprovalError(f"{label}.known status must have unknown_reason=null")
        if not evidence:
            raise ApprovalError(f"{label}.known status requires evidence")
    if status == "unavailable" and periods:
        raise ApprovalError(f"{label}.unavailable cannot contain periods")
    if status in POSITIVE_STATUSES and not periods:
        raise ApprovalError(f"{label}.{status} requires at least one period")
    return {
        "date": record_date.isoformat(),
        "status": status,
        "periods": periods,
        "conditions": conditions,
        "evidence": evidence,
        "unknown_reason": unknown_reason,
    }


def _validate_facility(value: Any, index: int) -> dict[str, Any]:
    label = f"facilities[{index}]"
    if not isinstance(value, dict):
        raise ApprovalError(f"{label} must be an object")
    _require_keys(value, ("trackId", "name", "approved", "reason", "sources", "records"), label)
    track_id = _require_string(value["trackId"], f"{label}.trackId")
    name = _require_string(value["name"], f"{label}.name")
    if type(value["approved"]) is not bool:
        raise ApprovalError(f"{label}.approved must be boolean")
    reason = _require_string(value["reason"], f"{label}.reason")
    sources_value = value["sources"]
    if not isinstance(sources_value, list) or not sources_value:
        raise ApprovalError(f"{label}.sources must be a non-empty array")
    sources: list[dict[str, str]] = []
    for source_index, source in enumerate(sources_value):
        source_label = f"{label}.sources[{source_index}]"
        if not isinstance(source, dict):
            raise ApprovalError(f"{source_label} must be an object")
        _require_keys(source, ("url", "sha256"), source_label)
        sources.append({
            "url": _validate_url(source["url"], f"{source_label}.url"),
            "sha256": _validate_hash(source["sha256"], f"{source_label}.sha256"),
        })
    records_value = value["records"]
    if not isinstance(records_value, list):
        raise ApprovalError(f"{label}.records must be an array")
    records: list[dict[str, Any]] = []
    dates: set[str] = set()
    for record_index, record in enumerate(records_value):
        normalized = _validate_record(record, f"{label}.records[{record_index}]")
        if normalized["date"] in dates:
            raise ApprovalError(f"{label} contains duplicate date {normalized['date']}")
        dates.add(normalized["date"])
        records.append(normalized)
    return {
        "trackId": track_id,
        "name": name,
        "approved": value["approved"],
        "reason": reason,
        "sources": sources,
        "records": records,
    }


def validate_approval(document: Any) -> dict[str, Any]:
    """Validate and normalize an approval document without writing anything."""

    if not isinstance(document, dict):
        raise ApprovalError("approval must be an object")
    _require_keys(document, ("schemaVersion", "facilities"), "approval")
    if document["schemaVersion"] != 1:
        raise ApprovalError("approval.schemaVersion must be 1")
    facilities_value = document["facilities"]
    if not isinstance(facilities_value, list):
        raise ApprovalError("approval.facilities must be an array")
    facilities: list[dict[str, Any]] = []
    track_ids: set[str] = set()
    for index, facility in enumerate(facilities_value):
        normalized = _validate_facility(facility, index)
        if normalized["trackId"] in track_ids:
            raise ApprovalError(f"duplicate trackId: {normalized['trackId']}")
        track_ids.add(normalized["trackId"])
        facilities.append(normalized)
    return {"schemaVersion": 1, "facilities": facilities}


def load_approval(path: Path) -> tuple[dict[str, Any], str]:
    """Load, hash, parse, and validate an approval file."""

    try:
        raw = path.read_bytes()
    except OSError as error:
        raise ApprovalError(f"could not read approval file: {error}") from error
    approval_sha256 = hashlib.sha256(raw).hexdigest()
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ApprovalError(f"approval is not valid UTF-8 JSON: {error}") from error
    return validate_approval(parsed), approval_sha256


class _RejectInsecureRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        target = urlparse(newurl)
        if target.scheme.lower() != "https" or not target.netloc:
            raise ShadowRunError("https_redirect_required")
        return super().redirect_request(request, fp, code, msg, headers, newurl)


def fetch_url(url: str) -> bytes:
    """Fetch one HTTPS source with a bounded response and no HTTP downgrade."""

    parsed = urlparse(url)
    if parsed.scheme.lower() != "https" or not parsed.netloc:
        raise ShadowRunError("https_url_required")
    request = Request(url, headers={"User-Agent": "itsrun-shadow-trial/1"})
    opener = build_opener(_RejectInsecureRedirect())
    try:
        response = opener.open(request, timeout=FETCH_TIMEOUT_SECONDS)
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        raise ShadowRunError(f"network_error: {error}") from error
    try:
        final_url = response.geturl()
        final_parsed = urlparse(final_url)
        if final_parsed.scheme.lower() != "https" or not final_parsed.netloc:
            raise ShadowRunError("https_redirect_required")
        content_length = response.headers.get("Content-Length")
        if content_length is not None:
            try:
                if int(content_length) > MAX_SOURCE_BYTES:
                    raise ShadowRunError("source_too_large")
            except ValueError:
                pass
        body = bytearray()
        while True:
            chunk = response.read(min(64 * 1024, MAX_SOURCE_BYTES + 1 - len(body)))
            if not chunk:
                break
            body.extend(chunk)
            if len(body) > MAX_SOURCE_BYTES:
                raise ShadowRunError("source_too_large")
        return bytes(body)
    finally:
        response.close()


def _error_text(error: BaseException) -> str:
    text = str(error).strip()
    if not text:
        text = error.__class__.__name__
    return text[:400]


def _source_url_order(facilities: Sequence[Mapping[str, Any]]) -> list[str]:
    ordered: OrderedDict[str, None] = OrderedDict()
    for facility in facilities:
        for source in facility["sources"]:
            ordered.setdefault(source["url"], None)
    return list(ordered)


def _expected_hashes_by_url(facilities: Sequence[Mapping[str, Any]]) -> dict[str, set[str]]:
    expected: dict[str, set[str]] = {}
    for facility in facilities:
        for source in facility["sources"]:
            expected.setdefault(source["url"], set()).add(source["sha256"])
    return expected


def _fetch_sources(facilities: Sequence[Mapping[str, Any]], fetcher: Fetcher) -> tuple[dict[str, SourceFetch], list[dict[str, Any]]]:
    cache: dict[str, SourceFetch] = {}
    checks: list[dict[str, Any]] = []
    expected_hashes = _expected_hashes_by_url(facilities)
    for url in _source_url_order(facilities):
        try:
            payload = fetcher(url)
            if not isinstance(payload, (bytes, bytearray, memoryview)):
                raise ShadowRunError("fetcher_must_return_bytes")
            payload_bytes = bytes(payload)
            if len(payload_bytes) > MAX_SOURCE_BYTES:
                raise ShadowRunError("source_too_large")
            actual_sha256 = hashlib.sha256(payload_bytes).hexdigest()
            result = SourceFetch(actual_sha256, None)
        except Exception as error:  # One failed source must become unknown, not abort the run.
            result = SourceFetch(None, f"source_fetch_failed: {_error_text(error)}")
        cache[url] = result
        hash_matches = result.sha256 is not None and result.sha256 in expected_hashes[url]
        check_error = result.error
        if check_error is None and not hash_matches:
            check_error = "source_changed"
        checks.append({
            "url": url,
            "sha256": result.sha256,
            "ok": result.error is None and hash_matches,
            "error": check_error,
        })
    return cache, checks


def _facility_source_state(facility: Mapping[str, Any], cache: Mapping[str, SourceFetch]) -> tuple[bool, str | None]:
    mismatch = False
    failure: str | None = None
    for source in facility["sources"]:
        fetched = cache[source["url"]]
        if fetched.error is not None:
            failure = fetched.error
            continue
        if fetched.sha256 != source["sha256"]:
            mismatch = True
    if failure is not None:
        return False, "source_fetch_failed"
    if mismatch:
        return False, "source_changed"
    return True, None


def _unknown_record(track_id: str, requested_date: str, reason: str) -> dict[str, Any]:
    return {
        "trackId": track_id,
        "date": requested_date,
        "status": "unknown",
        "periods": [],
        "conditions": [],
        "evidence": [],
        "unknown_reason": reason,
    }


def _date_reason(requested: date, reviewed_dates: Sequence[date]) -> str:
    if reviewed_dates and (requested < min(reviewed_dates) or requested > max(reviewed_dates)):
        return "approval_date_outside_reviewed_range"
    return "approval_record_missing"


def _requested_dates(from_date: str, days: int) -> list[date]:
    start = _parse_date(from_date, "--from")
    if type(days) is not int or days < 1 or days > MAX_DAYS:
        raise ShadowRunError(f"days must be an integer from 1 to {MAX_DAYS}")
    return [start + timedelta(days=offset) for offset in range(days)]


def _safe_run_id(run_id: str) -> str:
    if not isinstance(run_id, str) or not RUN_ID_PATTERN.fullmatch(run_id):
        raise ShadowRunError("run-id must be 1-64 characters: letters, digits, dot, underscore, or hyphen")
    return run_id


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def _markdown_cell(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def _summary_markdown(run_id: str, result: Mapping[str, Any], approval_sha256: str) -> str:
    summary = result["summary"]
    lines = [
        f"# Shadow availability trial: `{run_id}`",
        "",
        "This is a finite, nonpublic shadow result. It copies only reviewed records whose pinned HTTPS sources matched at fetch time.",
        "",
        f"- Approval SHA-256: `{approval_sha256}`",
        f"- Window: `{result['from']}` for `{result['days']}` day(s)",
        f"- Generated: `{result['generatedAt']}`",
        "",
        "## Summary",
        "",
        "| Metric | Value |",
        "|---|---:|",
    ]
    for key in ("facilityCount", "knownFacilityCount", "positiveFacilityCount", "knownFacilityDays", "positiveFacilityDays", "unknownFacilityDays", "httpRequests"):
        lines.append(f"| {key} | {summary[key]} |")
    lines.extend(["", "## Source checks", "", "| URL | SHA-256 | OK | Error |", "|---|---|---:|---|"])
    for check in result["sourceChecks"]:
        lines.append("| " + " | ".join(
            _markdown_cell(check[key] if check[key] is not None else "")
            for key in ("url", "sha256", "ok", "error")
        ) + " |")
    lines.extend(["", "## Records", "", "| Track | Date | Status | Unknown reason |", "|---|---|---|---|"])
    for record in result["records"]:
        lines.append("| " + " | ".join(_markdown_cell(record[key] or "") for key in ("trackId", "date", "status", "unknown_reason")) + " |")
    lines.append("")
    return "\n".join(lines)


def run(
    approval_path: str | os.PathLike[str],
    from_date: str,
    days: int = DEFAULT_DAYS,
    run_id: str | None = None,
    *,
    output_root: str | os.PathLike[str] | None = None,
    root: str | os.PathLike[str] | None = None,
    fetcher: Fetcher | None = None,
    generated_at: datetime | None = None,
) -> Path:
    """Run one finite shadow trial and return its new run directory.

    ``output_root``/``root`` are intentionally injectable for isolated unit
    tests.  The production default is always the script-local shadow folder.
    """

    if output_root is not None and root is not None:
        raise ShadowRunError("provide only one of output_root and root")
    if run_id is None:
        raise ShadowRunError("run-id is required")
    safe_run_id = _safe_run_id(run_id)
    requested_dates = _requested_dates(from_date, days)
    approval, approval_sha256 = load_approval(Path(approval_path))
    parent = Path(root if root is not None else output_root if output_root is not None else DEFAULT_OUTPUT_ROOT)
    output_dir = parent / safe_run_id
    if output_dir.exists():
        raise ShadowRunError(f"refusing to overwrite existing run directory: {output_dir}")
    if parent.exists() and not parent.is_dir():
        raise ShadowRunError(f"output root is not a directory: {parent}")

    cache, source_checks = _fetch_sources(approval["facilities"], fetcher or fetch_url)
    records: list[dict[str, Any]] = []
    for facility in approval["facilities"]:
        source_ok, source_reason = _facility_source_state(facility, cache)
        reviewed = {record["date"]: record for record in facility["records"]}
        reviewed_dates = [_parse_date(value, "approval record date") for value in reviewed]
        for requested in requested_dates:
            requested_text = requested.isoformat()
            if not source_ok:
                output_record = _unknown_record(facility["trackId"], requested_text, source_reason or "source_changed")
            elif not facility["approved"]:
                output_record = _unknown_record(facility["trackId"], requested_text, "approval_not_granted")
            elif requested_text not in reviewed:
                output_record = _unknown_record(facility["trackId"], requested_text, _date_reason(requested, reviewed_dates))
            else:
                reviewed_record = deepcopy(reviewed[requested_text])
                reviewed_record["trackId"] = facility["trackId"]
                output_record = reviewed_record
            records.append(output_record)

    known_days = sum(record["status"] != "unknown" for record in records)
    positive_days = sum(record["status"] in POSITIVE_STATUSES for record in records)
    unknown_days = sum(record["status"] == "unknown" for record in records)
    known_facilities = {record["trackId"] for record in records if record["status"] != "unknown"}
    positive_facilities = {record["trackId"] for record in records if record["status"] in POSITIVE_STATUSES}
    timestamp = generated_at or datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    timestamp_text = timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    result: dict[str, Any] = {
        "schemaVersion": 1,
        "mode": "nonpublic-shadow",
        "generatedAt": timestamp_text,
        "approvalSha256": approval_sha256,
        "from": requested_dates[0].isoformat(),
        "days": days,
        "sourceChecks": source_checks,
        "records": records,
        "summary": {
            "facilityCount": len(approval["facilities"]),
            "knownFacilityCount": len(known_facilities),
            "positiveFacilityCount": len(positive_facilities),
            "knownFacilityDays": known_days,
            "positiveFacilityDays": positive_days,
            "unknownFacilityDays": unknown_days,
            "httpRequests": len(source_checks),
        },
    }
    output_dir.mkdir(parents=True)
    _atomic_write(output_dir / "output.json", json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    _atomic_write(output_dir / "summary.md", _summary_markdown(safe_run_id, result, approval_sha256))
    return output_dir


def _argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a finite nonpublic reviewed-source availability shadow trial")
    parser.add_argument("--approval", required=True, type=Path, help="reviewed approval JSON")
    parser.add_argument("--from", dest="from_date", required=True, help="first date, YYYY-MM-DD")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"number of days, 1-{MAX_DAYS} (default: {DEFAULT_DAYS})")
    parser.add_argument("--run-id", required=True, help="new run name")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _argument_parser().parse_args(argv)
    try:
        run(args.approval, args.from_date, args.days, args.run_id)
    except (ApprovalError, ShadowRunError) as error:
        _argument_parser().error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

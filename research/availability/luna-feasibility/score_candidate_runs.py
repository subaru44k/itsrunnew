#!/usr/bin/env python3
"""Score three candidate availability runs against a reviewed reference.

The scorer is deliberately a small, deterministic research tool.  It joins
records by the requested case date for each facility, and keeps identity
diagnostics separate from the date-based arithmetic.  In particular, it does
not rewrite or repair a model record when an id is wrong, a date is missing,
or a date occurs more than once.

Run it from the repository root, for example::

    python3 research/availability/luna-feasibility/score_candidate_runs.py \
        --round-dir research/availability/luna-feasibility/results/round4

Only ``metrics.json`` is written.  The input files are read as-is.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean
from typing import Any, Iterable, Mapping, Sequence


POSITIVE_STATUSES = frozenset(("available", "partially_available"))
KNOWN_STATUSES = frozenset((*POSITIVE_STATUSES, "unavailable", "unknown"))
POSITIVE_PRECISION_THRESHOLD = 0.80
EXACT_HOURS_PRECISION_THRESHOLD = 0.70
RUN_COUNT = 3

# A normal schedule uses 00:00 through 23:59.  24:00 is accepted for an end
# point because it is a conventional representation of the end of a day in
# published facility schedules; a start point of 24:00 cannot form a positive
# length interval.
_TIME_RE = re.compile(r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")


def _payload_records(value: Any, *, source: str = "records") -> list[dict[str, Any]]:
    """Return the records array without modifying the decoded JSON value."""

    if isinstance(value, dict):
        records = value.get("records")
    else:
        records = value
    if not isinstance(records, list):
        raise ValueError(f"{source} must contain a records array")
    # Keep malformed entries in the list so they become diagnostics rather
    # than being silently discarded.  Validity is handled by the scorer.
    return records  # type: ignore[return-value]


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"required input is missing: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON in {path}: {exc}") from exc


def _load_records(path: Path) -> list[dict[str, Any]]:
    return _payload_records(_read_json(path), source=str(path))


def _case_date(case: Any) -> str | None:
    if not isinstance(case, Mapping):
        return None
    value = case.get("date")
    return value if isinstance(value, str) and value else None


def _case_id(case: Any) -> str | None:
    if not isinstance(case, Mapping):
        return None
    value = case.get("id")
    return value if isinstance(value, str) and value else None


def _record_date(record: Any) -> str | None:
    if not isinstance(record, Mapping):
        return None
    value = record.get("date")
    return value if isinstance(value, str) and value else None


def _record_id(record: Any) -> str | None:
    if not isinstance(record, Mapping):
        return None
    value = record.get("id")
    return value if isinstance(value, str) and value else None


def _group_by_date(records: Sequence[Any]) -> tuple[dict[str, list[Any]], list[int]]:
    """Group usable date values and return indexes of records without one."""

    groups: dict[str, list[Any]] = defaultdict(list)
    missing: list[int] = []
    for index, record in enumerate(records):
        date = _record_date(record)
        if date is None:
            missing.append(index)
        else:
            groups[date].append(record)
    return dict(groups), missing


def _case_maps(cases: Sequence[Any]) -> tuple[
    dict[str, list[Mapping[str, Any]]],
    dict[str, list[Mapping[str, Any]]],
    list[int],
]:
    by_date: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    by_id: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    malformed: list[int] = []
    for index, case in enumerate(cases):
        if not isinstance(case, Mapping):
            malformed.append(index)
            continue
        date = _case_date(case)
        case_id = _case_id(case)
        if date is None or case_id is None:
            malformed.append(index)
        if date is not None:
            by_date[date].append(case)
        if case_id is not None:
            by_id[case_id].append(case)
    return dict(by_date), dict(by_id), malformed


def _minutes(value: Any, *, allow_end_of_day: bool = False) -> int | None:
    if not isinstance(value, str):
        return None
    if allow_end_of_day and value == "24:00":
        return 24 * 60
    if _TIME_RE.fullmatch(value) is None:
        return None
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def _period_pair(period: Any) -> tuple[str, str] | None:
    if isinstance(period, Mapping):
        start, end = period.get("start"), period.get("end")
    elif isinstance(period, (tuple, list)) and len(period) == 2:
        start, end = period
    else:
        return None
    start_minutes = _minutes(start)
    end_minutes = _minutes(end, allow_end_of_day=True)
    if start_minutes is None or end_minutes is None or end_minutes <= start_minutes:
        return None
    # Do not return 24:00 as a start value (handled above by _minutes), and
    # retain the supplied zero-padded representation for ordinary values.
    return str(start), str(end)


def merge_intervals(periods: Iterable[Any]) -> list[tuple[str, str]] | None:
    """Validate and merge overlapping or adjacent ``start``/``end`` periods.

    ``None`` means that at least one period is empty or invalid.  This is
    intentionally different from an empty list: an empty list cannot be an
    exact match for a positive day, and the scorer treats both as non-matches.
    The return value is sorted and uses canonical minute ordering.
    """

    try:
        period_list = list(periods)
    except TypeError:
        return None
    if not period_list:
        return None

    parsed: list[tuple[int, int]] = []
    for period in period_list:
        pair = _period_pair(period)
        if pair is None:
            return None
        start = _minutes(pair[0])
        end = _minutes(pair[1], allow_end_of_day=True)
        if start is None or end is None:
            return None
        parsed.append((start, end))

    parsed.sort()
    merged: list[list[int]] = []
    for start, end in parsed:
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])

    def format_minutes(value: int) -> str:
        if value == 24 * 60:
            return "24:00"
        return f"{value // 60:02d}:{value % 60:02d}"

    return [(format_minutes(start), format_minutes(end)) for start, end in merged]


# A descriptive alias is useful to callers that prefer to make the union
# operation explicit.
union_intervals = merge_intervals


def _record_intervals(record: Any) -> list[tuple[str, str]] | None:
    if not isinstance(record, Mapping):
        return None
    periods = record.get("periods")
    if not isinstance(periods, list):
        return None
    return merge_intervals(periods)


def _is_positive(record: Any) -> bool:
    return isinstance(record, Mapping) and record.get("status") in POSITIVE_STATUSES


def is_positive_status(status: Any) -> bool:
    """Return whether a status contributes to the positive-day metrics."""

    return status in POSITIVE_STATUSES


def _mean_three(values: Sequence[float | None]) -> float | None:
    if len(values) != RUN_COUNT or any(value is None for value in values):
        return None
    return float(mean(values))


def acceptance_for_means(
    positive_mean: float | None,
    exact_hours_mean: float | None,
) -> bool:
    """Apply the strict, arithmetic-mean facility acceptance rule."""

    return (
        positive_mean is not None
        and exact_hours_mean is not None
        and positive_mean > POSITIVE_PRECISION_THRESHOLD
        and exact_hours_mean > EXACT_HOURS_PRECISION_THRESHOLD
    )


def _belongs_to_packet(
    record: Any,
    *,
    key: str | None,
    track_id: str | None,
    expected_ids: set[str],
) -> bool:
    record_id = _record_id(record)
    if record_id is None:
        return False
    if record_id in expected_ids:
        return True
    prefixes = tuple(
        prefix for prefix in (key, track_id) if isinstance(prefix, str) and prefix
    )
    return any(record_id.startswith(f"{prefix}-") for prefix in prefixes)


def _reference_candidates(
    *,
    date: str,
    case: Mapping[str, Any] | None,
    reference_records: Sequence[Any],
    key: str | None,
    track_id: str | None,
    expected_ids: set[str],
    packet_count: int,
) -> tuple[list[Any], str]:
    """Find reference records for a case without using another facility's row.

    Exact expected ids win.  A key/track prefix permits diagnostics to retain a
    same-facility record whose id is wrong.  The final date-only fallback is
    only used for a one-facility fixture, where it cannot collide with another
    facility's same date.
    """

    case_id = _case_id(case) if case is not None else None
    exact = [
        record
        for record in reference_records
        if _record_date(record) == date and case_id is not None and _record_id(record) == case_id
    ]
    if exact:
        return exact, "exact_id"

    scoped = [
        record
        for record in reference_records
        if _record_date(record) == date
        and _belongs_to_packet(
            record,
            key=key,
            track_id=track_id,
            expected_ids=expected_ids,
        )
    ]
    if scoped:
        return scoped, "same_facility_id"

    if packet_count == 1:
        return [record for record in reference_records if _record_date(record) == date], "single_facility_date"
    return [], "missing"


def _status_count(records: Iterable[Any]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for record in records:
        if isinstance(record, Mapping):
            status = record.get("status")
            if isinstance(status, str):
                counts[status] += 1
            else:
                counts["invalid_or_missing"] += 1
        else:
            counts["invalid_or_missing"] += 1
    return dict(sorted(counts.items()))


def _sorted_unique(values: Iterable[str]) -> list[str]:
    return sorted(set(values))


def _format_ratio(value: float | None) -> str:
    return "undefined" if value is None else f"{value:.4f}"


def score_run(
    packet_or_cases: Mapping[str, Any] | Sequence[Any],
    predicted_records: Sequence[Any],
    reference_records: Sequence[Any],
    *,
    packet_count: int = 1,
    all_expected_ids: set[str] | None = None,
    horizon: Sequence[str] | None = None,
    run_number: int | None = None,
) -> dict[str, Any]:
    """Score one run for one facility.

    ``packet_or_cases`` can be a packet mapping (the CLI form) or a bare cases
    list (convenient for small tests).  Matching uses unique requested dates;
    duplicate or missing prediction dates resolve to unknown for scoring.
    """

    if isinstance(packet_or_cases, Mapping):
        packet = packet_or_cases
        cases = packet.get("cases", [])
        key = packet.get("key") if isinstance(packet.get("key"), str) else None
        track_id = packet.get("trackId") if isinstance(packet.get("trackId"), str) else None
    else:
        packet = {}
        cases = packet_or_cases
        key = None
        track_id = None
    if not isinstance(cases, Sequence) or isinstance(cases, (str, bytes, bytearray)):
        raise ValueError("packet cases must be an array")
    if not isinstance(predicted_records, Sequence) or isinstance(predicted_records, (str, bytes, bytearray)):
        raise ValueError("predicted records must be an array")
    if not isinstance(reference_records, Sequence) or isinstance(reference_records, (str, bytes, bytearray)):
        raise ValueError("reference records must be an array")

    cases_by_date, cases_by_id, malformed_cases = _case_maps(cases)
    expected_dates = set(cases_by_date)
    expected_ids = set(cases_by_id)
    if all_expected_ids is None:
        all_expected_ids = expected_ids
    case_duplicate_dates = sorted(
        date for date, rows in cases_by_date.items() if len(rows) > 1
    )

    predictions_by_date, prediction_missing_date_indexes = _group_by_date(predicted_records)
    duplicate_dates = sorted(date for date, rows in predictions_by_date.items() if len(rows) > 1)
    extra_dates = sorted(set(predictions_by_date) - expected_dates)
    missing_dates = sorted(expected_dates - set(predictions_by_date))

    id_date_mismatches: list[dict[str, Any]] = []
    for date, rows in predictions_by_date.items():
        expected_for_date = cases_by_date.get(date, [])
        expected_case = expected_for_date[0] if len(expected_for_date) == 1 else None
        for record in rows:
            record_id = _record_id(record)
            if expected_case is not None:
                expected_id = _case_id(expected_case)
                if record_id != expected_id:
                    id_date_mismatches.append(
                        {
                            "date": date,
                            "expected_id": expected_id,
                            "actual_id": record_id,
                            "kind": "id_mismatch",
                        }
                    )
            elif record_id in expected_ids:
                expected_dates_for_id = {
                    _case_date(case)
                    for case in cases_by_id.get(record_id, [])
                    if _case_date(case) is not None
                }
                id_date_mismatches.append(
                    {
                        "date": date,
                        "expected_id": record_id,
                        "actual_id": record_id,
                        "expected_dates": sorted(expected_dates_for_id),
                        "kind": "date_mismatch",
                    }
                )

    invalid_prediction_records = [
        index
        for index, record in enumerate(predicted_records)
        if not isinstance(record, Mapping)
    ]

    reference_by_date: dict[str, list[Any]] = {}
    reference_source_by_date: dict[str, str] = {}
    reference_duplicate_dates: list[str] = []
    reference_missing_dates: list[str] = []
    reference_id_date_mismatches: list[dict[str, Any]] = []
    consumed_reference_indexes: set[int] = set()

    for date in sorted(expected_dates):
        cases_for_date = cases_by_date.get(date, [])
        case = cases_for_date[0] if len(cases_for_date) == 1 else None
        candidates, source = _reference_candidates(
            date=date,
            case=case,
            reference_records=reference_records,
            key=key,
            track_id=track_id,
            # Scope same-facility fallback to this packet.  Using the union
            # of every packet's IDs here would let another facility's row
            # with the same date masquerade as this facility's reference.
            expected_ids=expected_ids,
            packet_count=packet_count,
        )
        reference_by_date[date] = candidates
        reference_source_by_date[date] = source
        consumed_reference_indexes.update(
            index for index, record in enumerate(reference_records) if record in candidates
        )
        if len(candidates) == 0:
            reference_missing_dates.append(date)
        elif len(candidates) > 1:
            reference_duplicate_dates.append(date)
        for record in candidates:
            expected_id = _case_id(case) if case is not None else None
            record_id = _record_id(record)
            if expected_id is not None and record_id != expected_id:
                reference_id_date_mismatches.append(
                    {
                        "date": date,
                        "expected_id": expected_id,
                        "actual_id": record_id,
                        "kind": "id_mismatch",
                    }
                )

    # Reference records with expected IDs but another date are identity
    # diagnostics, while rows that do not belong to any requested case are
    # excluded as extras.  The raw row remains untouched in the input file.
    expected_case_by_id = {
        case_id: rows[0]
        for case_id, rows in cases_by_id.items()
        if len(rows) == 1
    }
    for index, record in enumerate(reference_records):
        record_id = _record_id(record)
        record_date = _record_date(record)
        if record_id in expected_case_by_id:
            expected_date = _case_date(expected_case_by_id[record_id])
            if record_date != expected_date:
                reference_id_date_mismatches.append(
                    {
                        "date": record_date,
                        "expected_id": record_id,
                        "actual_id": record_id,
                        "expected_date": expected_date,
                        "kind": "date_mismatch",
                    }
                )

    reference_extra_indexes: list[int] = []
    reference_extra_dates: list[str] = []
    for index, record in enumerate(reference_records):
        if index in consumed_reference_indexes:
            continue
        record_date = _record_date(record)
        record_id = _record_id(record)
        # The reviewed reference is shared by all facilities.  A row with
        # another packet's expected id is a valid row for that other packet,
        # not an extra row in this packet's diagnostics.
        if record_id in all_expected_ids and record_id not in expected_ids:
            continue
        belongs = _belongs_to_packet(
            record,
            key=key,
            track_id=track_id,
            expected_ids=expected_ids,
        )
        # A same-facility extra row is still an extra even when its date lies
        # inside the horizon; only requested case rows are scored.
        if record_date not in expected_dates or not belongs:
            reference_extra_indexes.append(index)
            if record_date is not None:
                reference_extra_dates.append(record_date)
        elif record_id not in expected_ids:
            reference_extra_indexes.append(index)
            if record_date is not None:
                reference_extra_dates.append(record_date)

    status_matches = 0
    status_mismatches = 0
    positive_day_count = 0
    positive_correct_count = 0
    exact_hours_match_count = 0
    reference_positive_day_count = 0
    recovered_reference_positive_day_count = 0
    invalid_prediction_period_days: list[str] = []
    invalid_reference_period_days: list[str] = []
    positive_predicted_days: list[str] = []
    positive_reference_days: list[str] = []
    status_counts_predicted: Counter[str] = Counter()
    status_counts_reference: Counter[str] = Counter()
    per_case: list[dict[str, Any]] = []

    def resolved_prediction(date: str) -> Any | None:
        rows = predictions_by_date.get(date, [])
        return rows[0] if len(rows) == 1 else None

    def resolved_reference(date: str) -> Any | None:
        rows = reference_by_date.get(date, [])
        return rows[0] if len(rows) == 1 else None

    for date in sorted(expected_dates):
        prediction = resolved_prediction(date)
        reference = resolved_reference(date)
        prediction_status = prediction.get("status") if isinstance(prediction, Mapping) else "unknown"
        reference_status = reference.get("status") if isinstance(reference, Mapping) else "unknown"
        if not isinstance(prediction_status, str) or prediction_status not in KNOWN_STATUSES:
            prediction_status = "unknown"
        if not isinstance(reference_status, str) or reference_status not in KNOWN_STATUSES:
            reference_status = "unknown"
        status_counts_predicted[prediction_status] += 1
        status_counts_reference[reference_status] += 1
        if prediction is not None and reference is not None:
            if prediction_status == reference_status:
                status_matches += 1
            else:
                status_mismatches += 1

        predicted_positive = _is_positive(prediction)
        reference_positive = _is_positive(reference)
        if predicted_positive:
            positive_day_count += 1
            positive_predicted_days.append(date)
            if reference_positive:
                positive_correct_count += 1
                if _record_intervals(prediction) is None:
                    invalid_prediction_period_days.append(date)
                if _record_intervals(reference) is None:
                    invalid_reference_period_days.append(date)
                if (
                    _record_intervals(prediction) is not None
                    and _record_intervals(reference) is not None
                    and _record_intervals(prediction) == _record_intervals(reference)
                ):
                    exact_hours_match_count += 1
        if reference_positive:
            reference_positive_day_count += 1
            positive_reference_days.append(date)
            if predicted_positive:
                recovered_reference_positive_day_count += 1

        per_case.append(
            {
                "date": date,
                "predicted_status": prediction_status,
                "reference_status": reference_status,
                "predicted_positive": predicted_positive,
                "reference_positive": reference_positive,
                "exact_hours_match": bool(
                    predicted_positive
                    and reference_positive
                    and _record_intervals(prediction) is not None
                    and _record_intervals(reference) is not None
                    and _record_intervals(prediction) == _record_intervals(reference)
                ),
                "prediction_resolved": prediction is not None,
                "reference_resolved": reference is not None,
            }
        )

    positive_precision = (
        positive_correct_count / positive_day_count if positive_day_count else None
    )
    exact_precision = (
        exact_hours_match_count / positive_day_count if positive_day_count else None
    )
    recall = (
        recovered_reference_positive_day_count / reference_positive_day_count
        if reference_positive_day_count
        else None
    )

    diagnostics = {
        "missing_dates": missing_dates,
        "duplicate_dates": duplicate_dates,
        "extra_dates": extra_dates,
        "records_without_date": prediction_missing_date_indexes,
        "invalid_prediction_records": invalid_prediction_records,
        "id_date_mismatches": id_date_mismatches,
        "reference_missing_dates": reference_missing_dates,
        "reference_duplicate_dates": reference_duplicate_dates,
        "reference_extra_dates": _sorted_unique(reference_extra_dates),
        "reference_extra_record_indexes": reference_extra_indexes,
        "reference_id_date_mismatches": reference_id_date_mismatches,
        "case_duplicate_dates": case_duplicate_dates,
        "malformed_cases": malformed_cases,
    }

    result: dict[str, Any] = {
        "run": run_number,
        "case_count": len(expected_dates),
        "positive_day_precision": positive_precision,
        "exact_hours_precision": exact_precision,
        "recall": recall,
        "counts": {
            "predicted_positive_days": positive_day_count,
            "positive_correct_days": positive_correct_count,
            "exact_hours_match_days": exact_hours_match_count,
            "reference_positive_days": reference_positive_day_count,
            "recovered_reference_positive_days": recovered_reference_positive_day_count,
            "status_matches": status_matches,
            "status_mismatches": status_mismatches,
        },
        "status_basics": {
            "predicted_status_counts": dict(sorted(status_counts_predicted.items())),
            "reference_status_counts": dict(sorted(status_counts_reference.items())),
            "positive_predicted_dates": positive_predicted_days,
            "positive_reference_dates": positive_reference_days,
            "invalid_prediction_period_dates": _sorted_unique(invalid_prediction_period_days),
            "invalid_reference_period_dates": _sorted_unique(invalid_reference_period_days),
        },
        "diagnostics": diagnostics,
        "cases": per_case,
    }

    if horizon is not None:
        horizon_dates = sorted(set(horizon))
        horizon_case_dates = sorted(expected_dates & set(horizon_dates))
        horizon_predicted_positive = sum(
            _is_positive(resolved_prediction(date)) for date in horizon_case_dates
        )
        horizon_reference_positive = sum(
            _is_positive(resolved_reference(date)) for date in horizon_case_dates
        )
        horizon_recovered = sum(
            _is_positive(resolved_prediction(date))
            and _is_positive(resolved_reference(date))
            for date in horizon_case_dates
        )
        horizon_exact = sum(
            _is_positive(resolved_prediction(date))
            and _is_positive(resolved_reference(date))
            and _record_intervals(resolved_prediction(date)) is not None
            and _record_intervals(resolved_reference(date)) is not None
            and _record_intervals(resolved_prediction(date))
            == _record_intervals(resolved_reference(date))
            for date in horizon_case_dates
        )
        result["horizon"] = {
            "requested_dates": horizon_dates,
            "case_dates": horizon_case_dates,
            "case_count": len(horizon_case_dates),
            "predicted_positive_day_count": horizon_predicted_positive,
            "reference_positive_day_count": horizon_reference_positive,
            "recovered_reference_positive_day_count": horizon_recovered,
            "exact_hours_match_day_count": horizon_exact,
            "positive_day_precision": (
                horizon_recovered / horizon_predicted_positive
                if horizon_predicted_positive
                else None
            ),
            "exact_hours_precision": (
                horizon_exact / horizon_predicted_positive
                if horizon_predicted_positive
                else None
            ),
            "recall": (
                horizon_recovered / horizon_reference_positive
                if horizon_reference_positive
                else None
            ),
        }

    return result


def score_facility(
    packet: Mapping[str, Any],
    run_records: Sequence[Sequence[Any]],
    reference_records: Sequence[Any],
    *,
    packet_count: int = 1,
    all_expected_ids: set[str] | None = None,
    horizon: Sequence[str] | None = None,
) -> dict[str, Any]:
    """Score the three runs belonging to one packet/facility."""

    if len(run_records) != RUN_COUNT:
        raise ValueError(f"expected exactly {RUN_COUNT} runs per facility")
    runs = [
        score_run(
            packet,
            records,
            reference_records,
            packet_count=packet_count,
            all_expected_ids=all_expected_ids,
            horizon=horizon,
            run_number=index,
        )
        for index, records in enumerate(run_records, start=1)
    ]
    positive_values = [run["positive_day_precision"] for run in runs]
    exact_values = [run["exact_hours_precision"] for run in runs]
    positive_mean = _mean_three(positive_values)
    exact_mean = _mean_three(exact_values)
    accepted = acceptance_for_means(positive_mean, exact_mean)

    result: dict[str, Any] = {
        "key": packet.get("key"),
        "track_id": packet.get("trackId"),
        "facility": packet.get("facility"),
        "case_count": len(packet.get("cases", [])) if isinstance(packet.get("cases"), list) else 0,
        "runs": runs,
        "mean_positive_day_precision": positive_mean,
        "mean_exact_hours_precision": exact_mean,
        "acceptance": {
            "mean_positive_day_precision": positive_mean,
            "mean_exact_hours_precision": exact_mean,
            "positive_threshold": POSITIVE_PRECISION_THRESHOLD,
            "exact_hours_threshold": EXACT_HOURS_PRECISION_THRESHOLD,
            "strict_greater_than": True,
            "accepted": accepted,
        },
        "accepted": accepted,
    }
    if horizon is not None:
        result["horizon"] = {
            "requested_dates": sorted(set(horizon)),
            "runs": [run.get("horizon") for run in runs],
        }
    return result


def _load_packets(path: Path) -> list[dict[str, Any]]:
    value = _read_json(path)
    if isinstance(value, dict) and isinstance(value.get("packets"), list):
        value = value["packets"]
    if not isinstance(value, list):
        raise ValueError(f"{path} must contain a packet list")
    return value  # type: ignore[return-value]


def _protocol_horizon(round_dir: Path) -> list[str] | None:
    protocol_path = round_dir / "protocol.json"
    if not protocol_path.exists():
        return None
    value = _read_json(protocol_path)
    horizon: Any = value.get("horizon") if isinstance(value, Mapping) else None
    if isinstance(horizon, Mapping):
        horizon = horizon.get("dates")
    if not isinstance(horizon, list):
        return None
    return sorted({date for date in horizon if isinstance(date, str) and date})


def score_round_dir(round_dir: str | Path) -> dict[str, Any]:
    """Load a round directory, score all packets, and write ``metrics.json``."""

    directory = Path(round_dir)
    packets = _load_packets(directory / "packets.json")
    reference_records = _load_records(directory / "primary-reviewed-reference.json")
    horizon = _protocol_horizon(directory)

    packet_ids: list[set[str]] = []
    for packet in packets:
        if not isinstance(packet, Mapping):
            packet_ids.append(set())
            continue
        cases = packet.get("cases", [])
        _, by_id, _ = _case_maps(cases if isinstance(cases, list) else [])
        packet_ids.append(set(by_id))
    all_expected_ids = set().union(*packet_ids) if packet_ids else set()

    facilities: list[dict[str, Any]] = []
    for packet_index, packet in enumerate(packets):
        if not isinstance(packet, Mapping):
            raise ValueError(f"packet {packet_index} must be an object")
        key = packet.get("key")
        if not isinstance(key, str) or not key:
            raise ValueError(f"packet {packet_index} has no non-empty key")
        run_records: list[list[dict[str, Any]]] = []
        for run_number in range(1, RUN_COUNT + 1):
            path = directory / f"luna-{key}-{run_number}-records.json"
            run_records.append(_load_records(path))
        facilities.append(
            score_facility(
                packet,
                run_records,
                reference_records,
                packet_count=len(packets),
                all_expected_ids=all_expected_ids,
                horizon=horizon,
            )
        )

    result: dict[str, Any] = {
        "schema_version": 1,
        "round_dir": str(directory),
        "positive_statuses": sorted(POSITIVE_STATUSES),
        "acceptance": {
            "positive_day_precision_threshold": POSITIVE_PRECISION_THRESHOLD,
            "exact_hours_precision_threshold": EXACT_HOURS_PRECISION_THRESHOLD,
            "strict": True,
            "mean": "arithmetic mean of three per-run fractions; not pooled",
            "zero_denominator": None,
        },
        "facility_count": len(facilities),
        "facilities": facilities,
        "accepted": bool(facilities) and all(facility["accepted"] for facility in facilities),
    }
    if horizon is not None:
        result["horizon"] = {
            "dates": horizon,
            "facility_count": len(facilities),
        }

    output_path = directory / "metrics.json"
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return result


def _print_summary(result: Mapping[str, Any], output_path: Path) -> None:
    print(f"Metrics written to {output_path}")
    for facility in result.get("facilities", []):
        key = facility.get("key", "?")
        print(
            f"{key}: "
            f"mean positive precision={_format_ratio(facility.get('mean_positive_day_precision'))}, "
            f"mean exact-hours precision={_format_ratio(facility.get('mean_exact_hours_precision'))}, "
            f"acceptance={'PASS' if facility.get('accepted') else 'FAIL'}"
        )
        for run in facility.get("runs", []):
            diagnostics = run.get("diagnostics", {})
            print(
                f"  run {run.get('run')}: "
                f"positive={_format_ratio(run.get('positive_day_precision'))}, "
                f"exact-hours={_format_ratio(run.get('exact_hours_precision'))}, "
                f"recall={_format_ratio(run.get('recall'))}; "
                f"missing={len(diagnostics.get('missing_dates', []))}, "
                f"duplicate={len(diagnostics.get('duplicate_dates', []))}, "
                f"extra={len(diagnostics.get('extra_dates', []))}, "
                f"id-mismatches={len(diagnostics.get('id_date_mismatches', []))}"
            )
    print(f"Round acceptance: {'PASS' if result.get('accepted') else 'FAIL'}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Score three Luna candidate availability runs")
    parser.add_argument(
        "--round-dir",
        required=True,
        type=Path,
        help="directory containing packets.json, the reviewed reference, and Luna run files",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        result = score_round_dir(args.round_dir)
    except (OSError, ValueError, TypeError) as exc:
        print(f"score_candidate_runs.py: {exc}", file=sys.stderr)
        return 2
    _print_summary(result, args.round_dir / "metrics.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

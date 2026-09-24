#!/usr/bin/env python3
"""Unit tests for the deterministic candidate-run scorer."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from score_candidate_runs import (
    acceptance_for_means,
    merge_intervals,
    score_facility,
    score_run,
    score_round_dir,
)


def case(key: str, date: str) -> dict[str, str]:
    return {"id": f"{key}-{date}", "date": date}


def record(
    key: str,
    date: str,
    status: str,
    periods: list[dict[str, str]] | None = None,
    *,
    record_id: str | None = None,
) -> dict[str, object]:
    return {
        "id": record_id or f"{key}-{date}",
        "date": date,
        "status": status,
        "periods": periods or [],
    }


def packet(key: str, dates: list[str]) -> dict[str, object]:
    return {
        "key": key,
        "trackId": f"{key}-track",
        "facility": key,
        "cases": [case(key, date) for date in dates],
    }


OPEN = [{"start": "09:00", "end": "17:00"}]


class CandidateMetricsTests(unittest.TestCase):
    def test_adjacent_intervals_merge_and_exact_hours_ignores_other_fields(self) -> None:
        periods = [
            {"start": "13:00", "end": "17:00", "scope": "x", "last_entry": "16:30"},
            {"start": "09:00", "end": "12:00", "scope": "y", "last_entry": None},
            {"start": "12:00", "end": "13:00", "scope": "z", "last_entry": None},
        ]
        self.assertEqual(merge_intervals(periods), [("09:00", "17:00")])
        p = packet("alpha", ["2026-01-01"])
        prediction = [record("alpha", "2026-01-01", "available", periods)]
        reference = [
            record(
                "alpha",
                "2026-01-01",
                "partially_available",
                [{"start": "09:00", "end": "17:00", "scope": "reference", "last_entry": "15:00"}],
            )
        ]
        result = score_run(p, prediction, reference)
        self.assertEqual(result["exact_hours_precision"], 1.0)

    def test_false_positive_stays_in_precision_denominator(self) -> None:
        p = packet("alpha", ["2026-01-01", "2026-01-02"])
        predictions = [
            record("alpha", "2026-01-01", "available", OPEN),
            record("alpha", "2026-01-02", "available", OPEN),
        ]
        references = [
            record("alpha", "2026-01-01", "available", OPEN),
            record("alpha", "2026-01-02", "unavailable"),
        ]
        result = score_run(p, predictions, references)
        self.assertEqual(result["counts"]["predicted_positive_days"], 2)
        self.assertEqual(result["positive_day_precision"], 0.5)
        self.assertEqual(result["exact_hours_precision"], 0.5)
        self.assertEqual(result["recall"], 1.0)

    def test_empty_positive_denominator_is_undefined(self) -> None:
        p = packet("alpha", ["2026-01-01"])
        result = score_run(
            p,
            [record("alpha", "2026-01-01", "unavailable")],
            [record("alpha", "2026-01-01", "available", OPEN)],
        )
        self.assertIsNone(result["positive_day_precision"])
        self.assertIsNone(result["exact_hours_precision"])
        self.assertFalse(acceptance_for_means(None, None))

    def test_acceptance_thresholds_are_strict(self) -> None:
        self.assertFalse(acceptance_for_means(0.80, 0.70))
        self.assertFalse(acceptance_for_means(0.800000, 0.700001))
        self.assertFalse(acceptance_for_means(0.800001, 0.70))
        self.assertTrue(acceptance_for_means(0.800001, 0.700001))

    def test_means_are_arithmetic_per_run_not_pooled(self) -> None:
        p = packet("alpha", ["2026-01-01", "2026-01-02"])
        references = [
            record("alpha", "2026-01-01", "available", OPEN),
            record("alpha", "2026-01-02", "unavailable"),
        ]
        runs = [
            [
                record("alpha", "2026-01-01", "available", OPEN),
                record("alpha", "2026-01-02", "available", OPEN),
            ],
            [record("alpha", "2026-01-01", "available", OPEN), record("alpha", "2026-01-02", "unavailable")],
            [record("alpha", "2026-01-01", "available", OPEN), record("alpha", "2026-01-02", "unavailable")],
        ]
        result = score_facility(p, runs, references)
        self.assertEqual([run["positive_day_precision"] for run in result["runs"]], [0.5, 1.0, 1.0])
        self.assertAlmostEqual(result["mean_positive_day_precision"], (0.5 + 1.0 + 1.0) / 3)
        self.assertNotEqual(result["mean_positive_day_precision"], 3 / 4)

    def test_missing_duplicate_extra_and_id_diagnostics_are_separate(self) -> None:
        p = packet("alpha", ["2026-01-01", "2026-01-02"])
        predictions = [
            record("alpha", "2026-01-01", "available", OPEN),
            record("alpha", "2026-01-01", "unavailable", record_id="wrong-2026-01-01"),
            record("alpha", "2026-01-03", "available", OPEN),
        ]
        references = [
            record("alpha", "2026-01-01", "available", OPEN),
            record("alpha", "2026-01-02", "unavailable"),
        ]
        result = score_run(p, predictions, references)
        diagnostics = result["diagnostics"]
        self.assertEqual(diagnostics["missing_dates"], ["2026-01-02"])
        self.assertEqual(diagnostics["duplicate_dates"], ["2026-01-01"])
        self.assertEqual(diagnostics["extra_dates"], ["2026-01-03"])
        self.assertEqual(len(diagnostics["id_date_mismatches"]), 1)
        # The duplicate date is unknown for scoring even though one row is positive.
        self.assertEqual(result["counts"]["predicted_positive_days"], 0)
        self.assertIsNone(result["positive_day_precision"])

    def test_cli_reads_round_and_writes_metrics_without_changing_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            round_dir = Path(temporary)
            p = packet("alpha", ["2026-01-01"])
            inputs: dict[str, object] = {
                "packets.json": [p],
                "primary-reviewed-reference.json": {"records": [record("alpha", "2026-01-01", "available", OPEN)]},
                "protocol.json": {"horizon": ["2026-01-01", "2026-01-02"]},
            }
            for name, value in inputs.items():
                (round_dir / name).write_text(json.dumps(value), encoding="utf-8")
            for number in range(1, 4):
                (round_dir / f"luna-alpha-{number}-records.json").write_text(
                    json.dumps({"records": [record("alpha", "2026-01-01", "available", OPEN)]}),
                    encoding="utf-8",
                )
            before = {
                name: (round_dir / name).read_bytes()
                for name in (
                    "packets.json",
                    "primary-reviewed-reference.json",
                    "protocol.json",
                    "luna-alpha-1-records.json",
                    "luna-alpha-2-records.json",
                    "luna-alpha-3-records.json",
                )
            }
            result = score_round_dir(round_dir)
            self.assertTrue(result["accepted"])
            self.assertTrue((round_dir / "metrics.json").exists())
            self.assertEqual(result["facilities"][0]["runs"][0]["horizon"]["predicted_positive_day_count"], 1)
            self.assertEqual(result["facilities"][0]["runs"][0]["horizon"]["reference_positive_day_count"], 1)
            for name, content in before.items():
                self.assertEqual((round_dir / name).read_bytes(), content)


if __name__ == "__main__":
    unittest.main()

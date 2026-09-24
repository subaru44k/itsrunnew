"""Focused tests for the finite reviewed-source shadow harness."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from shadow_collect import ApprovalError, ShadowRunError, run, validate_approval


def digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def approval_for(
    sources: list[tuple[str, bytes]],
    *,
    approved: bool = True,
    records: list[dict] | None = None,
    track_id: str = "trial-track",
) -> dict:
    return {
        "schemaVersion": 1,
        "facilities": [
            {
                "trackId": track_id,
                "name": "Trial track",
                "approved": approved,
                "reason": "independent reviewed trial",
                "sources": [{"url": url, "sha256": digest(payload)} for url, payload in sources],
                "records": records if records is not None else [
                    {
                        "date": "2026-09-21",
                        "status": "available",
                        "periods": [{"start": "09:00", "end": "12:00", "scope": "full_track", "last_entry": "11:00"}],
                        "conditions": ["reviewed source"],
                        "evidence": [{"source": sources[0][0], "location": "table row", "quote_or_symbol": "○"}],
                        "unknown_reason": None,
                    }
                ],
            }
        ],
    }


class ShadowCollectTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "shadow"
        self.approval_path = Path(self.temp.name) / "approval.json"
        self.payload = b"version-one"

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write_approval(self, document: dict) -> None:
        self.approval_path.write_text(json.dumps(document), encoding="utf-8")

    def test_known_record_is_preserved_and_shared_url_is_fetched_once(self) -> None:
        shared_url = "https://example.test/shared"
        document = approval_for([(shared_url, self.payload)])
        second = json.loads(json.dumps(document["facilities"][0]))
        second["trackId"] = "trial-track-two"
        second["name"] = "Trial track two"
        document["facilities"].append(second)
        self.write_approval(document)
        calls: list[str] = []

        def fetch(url: str) -> bytes:
            calls.append(url)
            return self.payload

        output_dir = run(
            self.approval_path,
            "2026-09-21",
            1,
            "known",
            root=self.root,
            fetcher=fetch,
            generated_at=datetime(2026, 9, 21, tzinfo=timezone.utc),
        )
        result = json.loads((output_dir / "output.json").read_text(encoding="utf-8"))
        self.assertEqual(calls, [shared_url])
        self.assertEqual(result["summary"]["httpRequests"], 1)
        self.assertEqual(result["summary"]["knownFacilityDays"], 2)
        self.assertEqual(result["records"][0]["status"], "available")
        self.assertEqual(result["records"][0]["periods"][0]["start"], "09:00")
        self.assertIn("approvalSha256", result)
        self.assertTrue((output_dir / "summary.md").exists())

    def test_source_change_and_fetch_failure_never_retain_reviewed_periods(self) -> None:
        changed_url = "https://example.test/changed"
        failed_url = "https://example.test/failed"
        changed_document = approval_for([(changed_url, self.payload)], track_id="changed")
        failed_document = approval_for([(failed_url, self.payload)], track_id="failed")
        changed_facility = changed_document["facilities"][0]
        failed_facility = failed_document["facilities"][0]
        document = {"schemaVersion": 1, "facilities": [changed_facility, failed_facility]}
        self.write_approval(document)

        def fetch(url: str) -> bytes:
            if url == changed_url:
                return b"version-two"
            raise OSError("offline")

        output_dir = run(self.approval_path, "2026-09-21", 1, "freshness", root=self.root, fetcher=fetch)
        result = json.loads((output_dir / "output.json").read_text(encoding="utf-8"))
        by_id = {record["trackId"]: record for record in result["records"]}
        self.assertEqual(by_id["changed"]["unknown_reason"], "source_changed")
        self.assertEqual(by_id["failed"]["unknown_reason"], "source_fetch_failed")
        checks = {check["url"]: check for check in result["sourceChecks"]}
        self.assertFalse(checks[changed_url]["ok"])
        self.assertEqual(checks[changed_url]["error"], "source_changed")
        self.assertFalse(checks[failed_url]["ok"])
        for record in by_id.values():
            self.assertEqual(record["periods"], [])
            self.assertEqual(record["evidence"], [])
            self.assertEqual(record["conditions"], [])

    def test_unapproved_and_missing_or_outside_dates_are_distinct_unknowns(self) -> None:
        url = "https://example.test/source"
        reviewed = approval_for([(url, self.payload)], records=[
            {
                "date": "2026-09-01",
                "status": "unavailable",
                "periods": [],
                "conditions": ["closed"],
                "evidence": [{"source": url, "location": "row", "quote_or_symbol": "×"}],
                "unknown_reason": None,
            }
        ])
        unapproved = json.loads(json.dumps(reviewed))
        unapproved["facilities"][0]["trackId"] = "unapproved"
        unapproved["facilities"][0]["approved"] = False
        document = {"schemaVersion": 1, "facilities": [reviewed["facilities"][0], unapproved["facilities"][0]]}
        self.write_approval(document)
        output_dir = run(self.approval_path, "2026-09-02", 2, "dates", root=self.root, fetcher=lambda _: self.payload)
        result = json.loads((output_dir / "output.json").read_text(encoding="utf-8"))
        records = [record for record in result["records"] if record["trackId"] == "trial-track"]
        unapproved_records = [record for record in result["records"] if record["trackId"] == "unapproved"]
        self.assertEqual(records[0]["unknown_reason"], "approval_date_outside_reviewed_range")
        self.assertEqual(unapproved_records[0]["unknown_reason"], "approval_not_granted")
        self.assertNotEqual(records[0]["unknown_reason"], unapproved_records[0]["unknown_reason"])

    def test_invalid_approval_duplicate_ids_dates_and_times_are_rejected(self) -> None:
        url = "https://example.test/source"
        document = approval_for([(url, self.payload)])
        duplicate_id = json.loads(json.dumps(document["facilities"][0]))
        document["facilities"].append(duplicate_id)
        with self.assertRaises(ApprovalError):
            validate_approval(document)

        duplicate_date = approval_for([(url, self.payload)])
        duplicate_date["facilities"][0]["records"].append(json.loads(json.dumps(duplicate_date["facilities"][0]["records"][0])))
        with self.assertRaises(ApprovalError):
            validate_approval(duplicate_date)

        invalid_time = approval_for([(url, self.payload)])
        invalid_time["facilities"][0]["records"][0]["periods"][0]["end"] = "08:00"
        with self.assertRaises(ApprovalError):
            validate_approval(invalid_time)

    def test_nullable_last_entry_boundaries_and_unavailable_periods(self) -> None:
        url = "https://example.test/source"

        nullable = approval_for([(url, self.payload)])
        period = nullable["facilities"][0]["records"][0]["periods"][0]
        period["last_entry"] = None
        normalized = validate_approval(nullable)
        self.assertIsNone(normalized["facilities"][0]["records"][0]["periods"][0]["last_entry"])

        for last_entry in ("09:00", "12:00"):
            boundary = approval_for([(url, self.payload)])
            boundary["facilities"][0]["records"][0]["periods"][0]["last_entry"] = last_entry
            validate_approval(boundary)

        for last_entry in ("08:59", "12:01"):
            outside = approval_for([(url, self.payload)])
            outside["facilities"][0]["records"][0]["periods"][0]["last_entry"] = last_entry
            with self.assertRaises(ApprovalError):
                validate_approval(outside)

        unavailable = approval_for([(url, self.payload)])
        unavailable_record = unavailable["facilities"][0]["records"][0]
        unavailable_record["status"] = "unavailable"
        unavailable_record["periods"] = [dict(unavailable_record["periods"][0])]
        with self.assertRaises(ApprovalError):
            validate_approval(unavailable)

    def test_missing_or_insecure_source_and_overwrite_are_rejected(self) -> None:
        missing_hash = approval_for([("https://example.test/source", self.payload)])
        del missing_hash["facilities"][0]["sources"][0]["sha256"]
        with self.assertRaises(ApprovalError):
            validate_approval(missing_hash)

        insecure = approval_for([("https://example.test/source", self.payload)])
        insecure["facilities"][0]["sources"][0]["url"] = "http://example.test/source"
        with self.assertRaises(ApprovalError):
            validate_approval(insecure)

        valid = approval_for([("https://example.test/source", self.payload)])
        self.write_approval(valid)
        self.root.mkdir(parents=True)
        (self.root / "already-used").mkdir()
        with self.assertRaises(ShadowRunError):
            run(self.approval_path, "2026-09-21", 1, "already-used", root=self.root, fetcher=lambda _: self.payload)

    def test_days_limit_and_unknown_record_validation(self) -> None:
        with self.assertRaises(ShadowRunError):
            run(self.approval_path, "2026-09-21", 63, "too-long", root=self.root, fetcher=lambda _: self.payload)

        url = "https://example.test/source"
        invalid_unknown = approval_for([(url, self.payload)])
        record = invalid_unknown["facilities"][0]["records"][0]
        record["status"] = "unknown"
        record["periods"] = []
        record["unknown_reason"] = None
        with self.assertRaises(ApprovalError):
            validate_approval(invalid_unknown)


if __name__ == "__main__":
    unittest.main()

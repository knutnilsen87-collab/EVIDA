from saksrom_ai.risk import build_control_report


def test_control_report_blocks_low_coverage():
    report = build_control_report(
        case_id="CASE-1",
        document_coverage_percent=80.0,
        source_coverage_percent=90.0,
        unsupported_claims=[],
        weak_sources=[],
        contradictions=[],
    )
    assert report.blocking is True

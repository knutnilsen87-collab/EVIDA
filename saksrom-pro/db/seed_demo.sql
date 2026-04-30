INSERT INTO cases (id, name, jurisdiction, status, created_at, updated_at)
VALUES ('CASE-DEMO', 'Demo: Hansen v X Kommune', 'NO', 'active', '2026-04-30T00:00:00Z', '2026-04-30T00:00:00Z');

INSERT INTO audit_events (id, case_id, actor, action, target_type, target_id, result, created_at)
VALUES ('AUD-DEMO-1', 'CASE-DEMO', 'system', 'case.seed', 'case', 'CASE-DEMO', 'PASS', '2026-04-30T00:00:00Z');

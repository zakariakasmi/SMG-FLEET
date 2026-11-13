-- =====================================================
-- RTC Logistique — import_vehicle_overrides (§5.3)
-- =====================================================
-- OM 142358 / 2025-01-10 has MATRICULE = '-' and CODE = '-' in the sheet, but the
-- mission is run by fleet vehicle 54134 B 7 (ledger code CTR44). Single-line group.
INSERT INTO import_vehicle_overrides (om, date_depart, line_no, plate_raw, code_raw, note) VALUES
  ('142358', '2025-01-10', 1, '54134-B-7', 'CTR44', 'override: plateless row, in fleet (bucket A)')
ON CONFLICT (om, date_depart, line_no) DO NOTHING;

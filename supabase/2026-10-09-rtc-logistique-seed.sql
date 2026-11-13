-- =====================================================
-- RTC Logistique — expense_categories seed (28) (§7)
-- =====================================================
INSERT INTO expense_categories (code, name_fr, name_en, source_column, is_divers, sort_order) VALUES
  ('auto_route',           'Auto route',              'Toll (Auto route)',        'Auto route',               false,  10),
  ('hotel',                'Hôtel',                   'Hotel',                    'Hotel',                    false,  20),
  ('frais_de_route',       'Frais de route',          'Travel expenses',         'frais de route',           false,  30),
  ('gardinnage',           'Gardiennage',             'Guarding',                'Gardinnage',               false,  40),
  ('proce',                'Procès',                  'Legal / court fees',      'Procès',                   false,  50),
  ('gasoil',               'Gasoil',                  'Diesel',                  'GASOIL',                   false,  60),
  ('divers',               'Divers',                  'Miscellaneous',           'Divers',                   true,   70),
  ('taxi',                 'Taxi',                    'Taxi',                    NULL,                       false, 100),
  ('autocar',              'Autocar',                 'Coach / bus',             NULL,                       false, 110),
  ('train',                'Train',                   'Train',                   NULL,                       false, 120),
  ('repas',                'Repas',                   'Meals',                   NULL,                       false, 130),
  ('achat',                'Achat',                   'Purchase',                NULL,                       false, 140),
  ('crevaison',            'Crevaison',               'Tyre puncture',           NULL,                       false, 150),
  ('lavage',               'Lavage',                  'Washing',                 NULL,                       false, 160),
  ('evacuation_dechets',   'Évacuation déchets',      'Waste removal',           NULL,                       false, 170),
  ('chargement_ciment',    'Chargement ciment',       'Cement loading',          NULL,                       false, 180),
  ('pesage',               'Pesage',                  'Weighing',                NULL,                       false, 190),
  ('escorte_gendarmerie',  'Escorte gendarmerie',     'Gendarmerie escort',      NULL,                       false, 200),
  ('reparation',           'Réparation',              'Repair',                  NULL,                       false, 210),
  ('bagage',               'Bagage',                  'Luggage',                 NULL,                       false, 220),
  ('pneus',                'Pneus',                   'Tyres',                   NULL,                       false, 230),
  ('extincteur',           'Extincteur',              'Fire extinguisher',       NULL,                       false, 240),
  ('transport_personnes',  'Transport personnes',     'Passenger transport',     NULL,                       false, 250),
  ('main_oeuvre',          'Main d''œuvre',           'Labour',                  NULL,                       false, 260),
  ('frais_admin',          'Frais administratifs',    'Administrative fees',     NULL,                       false, 270),
  ('postal',               'Postal / envoi',          'Postal / courier',        NULL,                       false, 280),
  ('parking',              'Parking',                 'Parking',                 NULL,                       false, 290),
  ('douane',               'Douane',                  'Customs',                 NULL,                       false, 300)
ON CONFLICT (code) DO NOTHING;

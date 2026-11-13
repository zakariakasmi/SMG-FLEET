-- =====================================================
-- RTC Logistique — schema (§10)
-- =====================================================
-- prerequisite: vehicles.brand / vehicles.fuel_type are NOT NULL today
ALTER TABLE vehicles ALTER COLUMN brand DROP NOT NULL;
ALTER TABLE vehicles ALTER COLUMN fuel_type DROP NOT NULL;

CREATE TABLE ledger_vehicles (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plate_norm    text        NOT NULL UNIQUE,
  plate_raw     text,
  vehicle_id    integer     REFERENCES vehicles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE drivers (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          varchar UNIQUE,
  alt_codes     varchar[],
  name          varchar,
  name_norm     varchar UNIQUE,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

CREATE TABLE expense_categories (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          varchar UNIQUE NOT NULL,
  name_fr       varchar NOT NULL,
  name_en       varchar NOT NULL,
  source_column varchar,
  is_divers     boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 0
);

CREATE TABLE missions (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  om                   varchar NOT NULL,
  date_depart          date    NOT NULL,
  depart               varchar,
  destination          varchar,
  a_travers            varchar,
  date_arriver         date,
  date_reglement       date,
  gendarmerie_required boolean NOT NULL DEFAULT false,
  source               varchar NOT NULL DEFAULT 'google_2025',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (om, date_depart)
);
CREATE INDEX missions_om_idx ON missions (om);
CREATE INDEX missions_date_depart_idx ON missions (date_depart);
CREATE INDEX missions_gendarmerie_idx ON missions (id) WHERE gendarmerie_required;

CREATE TABLE mission_vehicles (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mission_id        bigint    NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  vehicle_id        integer   REFERENCES vehicles(id) ON DELETE RESTRICT,
  ledger_vehicle_id bigint    REFERENCES ledger_vehicles(id) ON DELETE RESTRICT,
  vehicle_type_raw  varchar,
  vehicle_label     varchar,
  ledger_code       varchar,
  driver_id         integer   REFERENCES drivers(id),
  driver_code       varchar,
  driver_name       varchar,
  bordereau         varchar,
  description       text,
  observation       text,
  nature_de_charge  varchar,
  distance          numeric,
  duree             numeric,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_vehicles_one_vehicle CHECK (
      (CASE WHEN vehicle_id        IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN ledger_vehicle_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
  )
);
CREATE INDEX mv_mission_idx   ON mission_vehicles (mission_id);
CREATE INDEX mv_vehicle_idx   ON mission_vehicles (vehicle_id)   WHERE vehicle_id IS NOT NULL;
CREATE INDEX mv_ledger_idx    ON mission_vehicles (ledger_vehicle_id) WHERE ledger_vehicle_id IS NOT NULL;
CREATE INDEX mv_driver_idx    ON mission_vehicles (driver_id);

CREATE TABLE mission_expenses (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mission_vehicle_id  bigint    NOT NULL REFERENCES mission_vehicles(id) ON DELETE CASCADE,
  expense_category_id integer   NOT NULL REFERENCES expense_categories(id),
  amount              numeric   NOT NULL CHECK (amount > 0),
  source_column       varchar,
  parsed_label        varchar,
  needs_review        boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX me_mv_idx     ON mission_expenses (mission_vehicle_id);
CREATE INDEX me_category_idx ON mission_expenses (expense_category_id);
CREATE INDEX me_review_idx ON mission_expenses (id) WHERE needs_review;

CREATE TABLE import_vehicle_overrides (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  om           varchar NOT NULL,
  date_depart  date    NOT NULL,
  line_no      integer NOT NULL DEFAULT 1,
  plate_raw    varchar NOT NULL,
  code_raw     varchar,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (om, date_depart, line_no)
);

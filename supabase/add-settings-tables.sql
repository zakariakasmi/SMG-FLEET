-- Vehicle Types table
CREATE TABLE IF NOT EXISTS vehicle_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO vehicle_types (name) VALUES
  ('camion'), ('minibus'), ('van'), ('pickup'), ('tracteur')
ON CONFLICT (name) DO NOTHING;

-- Fuel Types table
CREATE TABLE IF NOT EXISTS fuel_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO fuel_types (name) VALUES
  ('Diesel'), ('Essence'), ('Electric'), ('Gas'), ('Hybrid')
ON CONFLICT (name) DO NOTHING;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  permissions TEXT[] DEFAULT '{}'::TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO users (username, password_hash, display_name, role) VALUES
  ('admin', 'admin', 'Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Disable RLS for new tables
ALTER TABLE vehicle_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

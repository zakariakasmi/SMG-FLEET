-- Make purchase_date optional to match UI requirements
ALTER TABLE vehicles ALTER COLUMN purchase_date DROP NOT NULL;
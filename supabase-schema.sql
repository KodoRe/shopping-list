-- Shopping List App - Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor

-- Items table
CREATE TABLE items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category text DEFAULT 'other',
  qty text DEFAULT '',
  checked boolean DEFAULT false,
  added_by text DEFAULT 'app',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Recipes table
CREATE TABLE recipes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  servings text DEFAULT '',
  time text DEFAULT '',
  cuisine text DEFAULT '',
  source text DEFAULT '',
  source_type text DEFAULT '',
  notes text DEFAULT '',
  ingredients jsonb DEFAULT '[]'::jsonb,
  steps jsonb DEFAULT '[]'::jsonb,
  added_by text DEFAULT 'app',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Allow all operations (open access via anon key)
CREATE POLICY "Allow all on items" ON items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on recipes" ON recipes FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE recipes;

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

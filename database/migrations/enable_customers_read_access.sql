-- Enable read access to all authenticated users for customers table
-- This is necessary for the card enrollment page to search for customers

-- If policy already exists, drop it first to avoid errors
DROP POLICY IF EXISTS "Enable read access for all users" ON customers;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON customers;

-- Create new policy allowing read access to public
CREATE POLICY "Public profiles are viewable by everyone" 
ON customers FOR SELECT 
USING (true);

-- Ensure RLS is enabled
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Update RLS to allow reading soft-deleted items
-- (We rely on the API to filter what is shown to the user)

DROP POLICY IF EXISTS "View Active Campaigns" ON public.campaigns;

CREATE POLICY "View All Campaigns" ON public.campaigns
FOR SELECT
TO authenticated
USING (true);

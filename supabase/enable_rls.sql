-- Enable Row Level Security (RLS) on the live_tickets table
ALTER TABLE public.live_tickets ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow authenticated users to SELECT
CREATE POLICY "Allow authenticated users to SELECT live_tickets" 
ON public.live_tickets 
FOR SELECT 
TO authenticated 
USING (true);

-- Create a policy to allow service role / API to INSERT tickets
-- Note: the service role key bypasses RLS, but if you're using anon key you'd need an insert policy
CREATE POLICY "Allow anon to INSERT live_tickets" 
ON public.live_tickets 
FOR INSERT 
TO anon 
WITH CHECK (true);

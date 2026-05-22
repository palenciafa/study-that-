// ════════════════════════════════════════════════════
//  SUPABASE CONFIG
//  1. Go to https://supabase.com and create a free project
//  2. In your project: Settings → API
//  3. Copy your Project URL and anon/public key below
// ════════════════════════════════════════════════════

const SUPABASE_URL = 'https://qqdxocoefatwilbtjajq.supabase.co';       
const SUPABASE_ANON_KEY = 'sb_publishable_Eg9iu_1V8SLDMdDHRhnc5Q_hFMEywOH'; 

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

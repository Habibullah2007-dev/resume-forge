import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing supabase URL/Key in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  console.log("Fetching one row from analyzed_resumes...");
  const { data, error } = await supabase
    .from('analyzed_resumes')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching rows:", error);
  } else {
    console.log("Success! Columns / Data structure:", data);
  }
}

checkSchema();

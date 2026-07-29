import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSelectAll() {
  const fields = [
    'user_id',
    'job_title',
    'original_resume_text',
    'job_description_text',
    'gap_analysis',
    'tailored_resume_text',
    'ats_check',
    'created_at'
  ];
  
  console.log("Checking all new columns...");
  const res = await supabase.from('analyzed_resumes').select(fields.join(',')).limit(1);
  if (res.error) {
    console.error("Select failed:", res.error.message, res.error.code);
  } else {
    console.log("All new columns exist and are accessible!");
  }
}

testSelectAll();

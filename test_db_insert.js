import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  console.log("Signing up a test user...");
  const email = `testuser_${Date.now()}@gmail.com`;
  const password = "testPassword123!";

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.error("Sign up failed:", signUpError.message);
    return;
  }

  const user = signUpData.user;
  console.log("Signed up successfully! User ID:", user.id);

  // Sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error("Sign in failed:", signInError.message);
    return;
  }

  const session = signInData.session;
  console.log("Signed in successfully! Session Token present.");

  // Create a new client authenticated with the user's session token
  const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    }
  });

  console.log("Attempting insert into analyzed_resumes...");
  const mockRecord = {
    user_id: user.id,
    job_title: "Test Job Title",
    original_resume_text: "Original Resume Text Content",
    job_description_text: "Job Description Text Content",
    gap_analysis: { missing_keywords: ["keyword1"], missing_skills: ["skill1"], weak_sections: [] },
    tailored_resume_text: JSON.stringify({ summary: "Summary text", skills: "Skills text", experience: "Experience text" }),
    ats_check: { issues: ["formatting issue"], passed: false }
  };

  const { data: insertData, error: insertError } = await authSupabase
    .from('analyzed_resumes')
    .insert(mockRecord)
    .select();

  if (insertError) {
    console.error("Insert failed:", insertError.message, insertError.code, insertError.details);
  } else {
    console.log("Insert succeeded!", insertData);
    
    // Clean up
    console.log("Deleting inserted record...");
    const { error: deleteError } = await authSupabase
      .from('analyzed_resumes')
      .delete()
      .eq('id', insertData[0].id);

    if (deleteError) {
      console.error("Delete cleanup failed:", deleteError.message);
    } else {
      console.log("Cleanup succeeded!");
    }
  }
}

testInsert();

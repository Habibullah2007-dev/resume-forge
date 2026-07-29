const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing supabase URL/Key in .env");
  process.exit(1);
}

async function getColumns() {
  const res = await fetch(supabaseUrl + '/rest/v1/', {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  });
  const data = await res.json();
  const definition = data.definitions?.analyzed_resumes;
  if (definition) {
    console.log("analyzed_resumes schema columns:", Object.keys(definition.properties));
  } else {
    console.log("Could not find definition for analyzed_resumes. Table list:", Object.keys(data.definitions || {}));
  }
}

getColumns();

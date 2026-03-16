require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function testSignIn() {
  const email = "jmproductionrd@gmail.com";
  const password = "09071124.";

  console.log("Trying to sign in:", email);
  const { data, error } = await supabasePublic.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error("Auth Error:", error.message);
  } else {
    console.log("Auth Success. User ID:", data.user.id);
  }
}

testSignIn();

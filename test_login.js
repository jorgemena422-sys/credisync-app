require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function testSignIn() {
  const email = String(process.env.TEST_USER_EMAIL || '').trim();
  const password = String(process.env.TEST_USER_PASSWORD || '').trim();

  if (!email || !password) {
    throw new Error('Define TEST_USER_EMAIL y TEST_USER_PASSWORD antes de ejecutar este script.');
  }

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

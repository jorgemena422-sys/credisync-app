require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function resetPassword() {
  const email = String(process.env.TEST_USER_EMAIL || '').trim();
  const password = String(process.env.TEST_USER_PASSWORD || '').trim();

  if (!email || !password) {
    throw new Error('Define TEST_USER_EMAIL y TEST_USER_PASSWORD antes de ejecutar este script.');
  }

  console.log("Looking up user by email:", email);
  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError.message);
    return;
  }

  const user = users.users.find(u => u.email === email);
  if (!user) {
    console.log("User not found!");
    return;
  }

  console.log("Updating password for user:", user.id);
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: password,
    email_confirm: true
  });

  if (error) {
    console.error("Error updating user:", error.message);
  } else {
    console.log("Password updated successfully for", email);
  }
}

resetPassword();

// Promotes an existing, confirmed account to administrator.
// The person must first register through the app. No credentials are stored
// in code: the service role key is read from the environment.
//
// Usage: node --env-file=.env.local scripts/promote-admin.mjs owner@palmbite.example
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: node --env-file=.env.local scripts/promote-admin.mjs <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.rpc("promote_to_admin", { p_email: email });
if (error) {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
}
if (data?.code !== "OK") {
  console.error(`No account found for ${email}. Ask them to register in the app first.`);
  process.exit(1);
}
console.log(`${email} is now an administrator. Sign in and open /admin.`);

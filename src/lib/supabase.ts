import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabasePublishableKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

if (/[^\x00-\x7F]/.test(supabaseUrl)) {
  throw new Error("Supabase URL contains non-ASCII characters");
}

if (/[^\x00-\x7F]/.test(supabasePublishableKey)) {
  throw new Error("Supabase publishable key contains non-ASCII characters");
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);
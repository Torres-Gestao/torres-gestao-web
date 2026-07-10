import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.error(
    "Faltando VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Configure o arquivo .env.",
  );
}

export const supabase = createClient<Database>(url ?? "", anon ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

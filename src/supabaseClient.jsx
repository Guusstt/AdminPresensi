import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://eyueihzugmafojphrfuz.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5dWVpaHp1Z21hZm9qcGhyZnV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDY2MDAsImV4cCI6MjA2NDk4MjYwMH0.OCbtGc_GBzYF2NEnsSLUPKBSb-RZEgxctJELmWIpeMU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

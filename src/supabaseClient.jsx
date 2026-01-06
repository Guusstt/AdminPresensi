import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hbddnncmogusqvehydtj.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZGRubmNtb2d1c3F2ZWh5ZHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDcxMzcsImV4cCI6MjA4MzI4MzEzN30.lJAjrJOp76292Qjn5t2hBbztGdUcHAhTTfo9fWo08kY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

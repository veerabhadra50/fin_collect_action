import { createClient } from '@supabase/supabase-js';

let _instance = null;

export function getSupabase() {
  if (!_instance) {
    _instance = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return _instance;
}

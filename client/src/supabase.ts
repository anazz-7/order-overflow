import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://thacoqdgeuuvhcnyoqxo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoYWNvcWRnZXV1dmhjbnlvcXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4Mzk4MzYsImV4cCI6MjEwODQxNTgzNn0.M0Ilb2j681GTiozcl8hoTTXs_58HHPiLPvZ2c0qtaz4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

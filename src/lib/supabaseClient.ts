// src/lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Replace these with your actual Supabase credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ppfzefgmkfmlcjalwvuv.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZnplZmdta2ZtbGNqYWx3dnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNzgzMjIsImV4cCI6MjA3ODk1NDMyMn0.jITiT8LaYasd46Rj-x2LWBrP9o5-0FtAL2qJzj9sPrI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Type definitions for database
export type Database = {
  conversations: {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
  };
  messages: {
    id: string;
    conversation_id: string;
    text: string;
    sender: 'user' | 'ai';
    created_at: string;
  };
};
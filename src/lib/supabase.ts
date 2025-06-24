import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('[Supabase] Faltan variables de entorno');
}

// Cliente para el lado del cliente (navegador) - tu código existente
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Cliente para el lado del servidor (con permisos elevados) - NUEVO
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Tipos TypeScript para las tablas - NUEVO
export interface League {
  id: string;
  name: string;
  description?: string;
  creator_id: string;
  max_users: number;
  budget_per_user: number;
  market_duration_hours: number;
  market_players_count: number;
  status: 'draft' | 'active' | 'finished';
  created_at: string;
  updated_at: string;
}

export interface LeagueParticipant {
  id: string;
  league_id: string;
  user_id: string;
  budget_remaining: number;
  total_points: number;
  joined_at: string;
}
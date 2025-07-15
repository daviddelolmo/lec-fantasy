// src/pages/api/swapStarter.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { starterId, benchId, userId, leagueId } = await request.json();

    if (!starterId || !benchId || !userId || !leagueId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Cambia is_starter entre los dos jugadores
    const { error: error1 } = await supabase
      .from('user_teams')
      .update({ is_starter: false })
      .eq('player_id', starterId)
      .eq('user_id', userId)
      .eq('league_id', leagueId);

    const { error: error2 } = await supabase
      .from('user_teams')
      .update({ is_starter: true })
      .eq('player_id', benchId)
      .eq('user_id', userId)
      .eq('league_id', leagueId);

    if (error1 || error2) {
      console.error('Supabase errors:', error1, error2);
      return new Response(JSON.stringify({ 
        error: 'Error al intercambiar roles',
        details: error1?.message || error2?.message 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
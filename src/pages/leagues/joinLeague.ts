import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { league_id } = await request.json();

    if (!league_id) {
      return new Response(JSON.stringify({ 
        error: 'ID de liga requerido' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener el usuario autenticado
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'Usuario no autenticado' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Token de autenticación inválido' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que la liga existe y está disponible
    const { data: league, error: leagueError } = await supabaseAdmin
      .from('leagues')
      .select('id, name, max_users, budget_per_user, status')
      .eq('id', league_id)
      .single();

    if (leagueError || !league) {
      return new Response(JSON.stringify({ 
        error: 'Liga no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que la liga está en estado draft
    if (league.status !== 'draft') {
      return new Response(JSON.stringify({ 
        error: 'No se puede unir a una liga que ya ha comenzado' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que el usuario no esté ya en la liga
    const { data: existingParticipant } = await supabaseAdmin
      .from('league_participants')
      .select('id')
      .eq('league_id', league_id)
      .eq('user_id', user.id)
      .single();

    if (existingParticipant) {
      return new Response(JSON.stringify({ 
        error: 'Ya eres parte de esta liga' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Contar participantes actuales
    const { count, error: countError } = await supabaseAdmin
      .from('league_participants')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', league_id);

    if (countError) {
      console.error('Error counting participants:', countError);
      return new Response(JSON.stringify({ 
        error: 'Error interno del servidor' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que hay espacio en la liga
    if (count >= league.max_users) {
      return new Response(JSON.stringify({ 
        error: 'La liga está llena' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Agregar al usuario como participante
    const { data: participant, error: participantError } = await supabaseAdmin
      .from('league_participants')
      .insert({
        league_id: league_id,
        user_id: user.id,
        budget_remaining: league.budget_per_user
      })
      .select()
      .single();

    if (participantError) {
      console.error('Error adding participant:', participantError);
      return new Response(JSON.stringify({ 
        error: 'Error al unirse a la liga' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Registrar actividad
    await supabaseAdmin
      .from('league_activity')
      .insert({
        league_id: league_id,
        user_id: user.id,
        activity_type: 'USER_JOINED',
        description: `${user.email} se unió a la liga "${league.name}"`,
        metadata: {
          league_name: league.name,
          participant_count: count + 1
        }
      });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Te has unido exitosamente a la liga',
      participant: participant
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error inesperado:', error);
    return new Response(JSON.stringify({ 
      error: 'Error interno del servidor' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
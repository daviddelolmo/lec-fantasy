// src/pages/api/leagues/create.ts
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';

export const POST: APIRoute = async ({ request, redirect }) => {
  try {
    // Obtener datos del formulario
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const maxUsers = parseInt(formData.get('max_users') as string);
    const budgetPerUser = parseInt(formData.get('budget_per_user') as string);
    const marketDurationHours = parseInt(formData.get('market_duration_hours') as string);
    const marketPlayersCount = parseInt(formData.get('market_players_count') as string);

    // Validaciones básicas
    if (!name || name.trim().length === 0) {
      return new Response(JSON.stringify({ 
        error: 'El nombre de la liga es requerido' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (maxUsers < 4 || maxUsers > 20) {
      return new Response(JSON.stringify({ 
        error: 'El número de usuarios debe estar entre 4 y 20' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (budgetPerUser < 5000) {
      return new Response(JSON.stringify({ 
        error: 'El presupuesto mínimo es 5,000€' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener el usuario autenticado desde las cookies/headers
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'Usuario no autenticado' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar el token del usuario usando supabaseAdmin
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ 
        error: 'Token de autenticación inválido' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convertir el presupuesto a céntimos para almacenar en la BD
    const budgetInCents = budgetPerUser * 100;

    console.log('🎯 Creando liga para usuario:', user.id);

    // Crear la liga en la base de datos
    const { data: league, error: leagueError } = await supabaseAdmin
      .from('leagues')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        creator_id: user.id,
        max_users: maxUsers,
        budget_per_user: budgetInCents,
        market_duration_hours: marketDurationHours,
        market_players_count: marketPlayersCount,
        status: 'draft'
      })
      .select()
      .single();

    if (leagueError) {
      console.error('Error creando liga:', leagueError);
      return new Response(JSON.stringify({ 
        error: 'Error interno del servidor al crear la liga' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Liga creada:', league.id);

    // Agregar al creador como participante de la liga
    const { data: participant, error: participantError } = await supabaseAdmin
      .from('league_participants')
      .insert({
        league_id: league.id,
        user_id: user.id,
        budget_remaining: budgetInCents
      })
      .select()
      .single();

    if (participantError) {
      console.error('Error agregando participante:', participantError);
      // Si falla agregar como participante, eliminar la liga creada
      await supabaseAdmin.from('leagues').delete().eq('id', league.id);
      
      return new Response(JSON.stringify({ 
        error: 'Error interno del servidor al unirse a la liga' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Participante agregado:', participant.id);

    // Registrar actividad de creación de liga
    await supabaseAdmin
      .from('league_activity')
      .insert({
        league_id: league.id,
        user_id: user.id,
        activity_type: 'LEAGUE_CREATED',
        description: `${user.email} creó la liga "${name}"`,
        metadata: {
          league_name: name,
          max_users: maxUsers,
          budget_per_user: budgetPerUser
        }
      });

    console.log('✅ Liga creada exitosamente');

    // Redirigir a la página de la liga creada
    return redirect(`/leagues/${league.id}`, 302);

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
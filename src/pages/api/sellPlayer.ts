// src/pages/api/sellPlayer.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export async function POST({ request }) {
  try {
    const { playerId, leagueId, userId, startingPrice } = await request.json();

    // Validar que todos los campos requeridos están presentes
    if (!playerId || !leagueId || !userId || !startingPrice) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Faltan campos requeridos'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verificar que el jugador pertenece al usuario en la liga
    const { data: userTeamCheck, error: teamCheckError } = await supabase
      .from('user_teams')
      .select('player_id')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('player_id', playerId)
      .single();

    if (teamCheckError || !userTeamCheck) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No tienes este jugador en tu equipo'
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verificar que el jugador no está ya en subasta
    const { data: existingAuction, error: auctionCheckError } = await supabase
      .from('market_auctions')
      .select('id')
      .eq('player_id', playerId)
      .eq('league_id', leagueId)
      .eq('status', 'active')
      .single();

    if (existingAuction) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Este jugador ya está en subasta'
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Obtener información del jugador
    const { data: playerInfo, error: playerError } = await supabase
      .from('lec_players')
      .select('name, position, team, market_value')
      .eq('id', playerId)
      .single();

    if (playerError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Error al obtener información del jugador'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Realizar operaciones directas en la base de datos
    try {
      // 1. Eliminar el jugador del equipo del usuario
      const { error: deleteError } = await supabase
        .from('user_teams')
        .delete()
        .eq('user_id', userId)
        .eq('league_id', leagueId)
        .eq('player_id', playerId);

      if (deleteError) {
        console.error('Error al eliminar jugador del equipo:', deleteError);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Error al quitar el jugador del equipo'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // 2. Crear la subasta en el mercado (ajustado a tu estructura)
      const auctionEndTime = new Date();
      auctionEndTime.setHours(auctionEndTime.getHours() + 24); // 24 horas de duración

      const { data: auctionData, error: auctionError } = await supabase
        .from('market_auctions')
        .insert([
          {
            league_id: leagueId,
            player_id: playerId,
            seller_id: userId,
            current_bidder_id: null,
            current_bid: null,
            min_bid: startingPrice,
            ends_at: auctionEndTime.toISOString(),
            status: 'active'
          }
        ])
        .select('id')
        .single();

      if (auctionError) {
        console.error('Error al crear subasta:', auctionError);
        
        // Revertir: volver a agregar el jugador al equipo
        await supabase
          .from('user_teams')
          .insert([
            {
              user_id: userId,
              league_id: leagueId,
              player_id: playerId,
              is_starter: false // Lo ponemos como suplente por defecto
            }
          ]);

        return new Response(
          JSON.stringify({
            success: false,
            message: 'Error al crear la subasta en el mercado'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // 3. Actualizar el presupuesto del usuario (opcional: dar una pequeña compensación)
      const compensationAmount = Math.floor(startingPrice * 0.1); // 10% del precio inicial
      
      if (compensationAmount > 0) {
        const { error: budgetError } = await supabase
          .from('league_participants')
          .update({
            budget_remaining: supabase.sql`budget_remaining + ${compensationAmount}`
          })
          .eq('user_id', userId)
          .eq('league_id', leagueId);

        if (budgetError) {
          console.error('Error al actualizar presupuesto:', budgetError);
          // No fallar por esto, es opcional
        }
      }

      // 4. Respuesta exitosa
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Jugador vendido exitosamente',
          data: {
            auctionId: auctionData.id,
            playerName: playerInfo.name,
            startingPrice: startingPrice,
            minBid: startingPrice,
            auctionEnd: auctionEndTime.toISOString(),
            compensationAmount: compensationAmount
          }
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );

    } catch (operationError) {
      console.error('Error en las operaciones de venta:', operationError);
      
      // Intentar revertir si es posible
      try {
        await supabase
          .from('user_teams')
          .insert([
            {
              user_id: userId,
              league_id: leagueId,
              player_id: playerId,
              is_starter: false
            }
          ]);
      } catch (revertError) {
        console.error('Error al revertir:', revertError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Error en la transacción de venta'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Error en sellPlayer:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error interno del servidor'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
// src/pages/api/placeBid.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { auctionId, bidAmount, userId, leagueId } = await request.json();

    // Validaciones básicas
    if (!auctionId || !bidAmount || !userId || !leagueId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Faltan campos requeridos' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (bidAmount <= 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'El monto de la puja debe ser positivo' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar información básica de la subasta
    const { data: auction, error: auctionError } = await supabase
      .from('market_auctions')
      .select('min_bid, status, ends_at')
      .eq('id', auctionId)
      .single();

    if (auctionError || !auction) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Subasta no encontrada' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que la subasta esté activa
    if (auction.status !== 'active' || new Date() >= new Date(auction.ends_at)) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'La subasta no está activa o ha finalizado' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar presupuesto del usuario
    const { data: participant, error: participantError } = await supabase
      .from('league_participants')
      .select('budget_remaining')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .single();

    if (participantError || !participant) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Usuario no encontrado en la liga' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (bidAmount > participant.budget_remaining) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Presupuesto insuficiente' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Buscar puja existente del usuario para esta subasta
    const { data: existingBid, error: existingBidError } = await supabase
      .from('auction_bids')
      .select('id, bid_amount')
      .eq('auction_id', auctionId)
      .eq('bidder_id', userId)
      .maybeSingle();

    if (existingBidError) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Error al verificar pujas existentes' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar puja mínima solo si no tiene puja previa
    if (!existingBid && bidAmount < auction.min_bid) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: `La puja mínima es ${auction.min_bid.toLocaleString()}€` 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let previousBidAmount = null;
    let isUpdate = false;

    if (existingBid) {
      // ACTUALIZAR puja existente
      previousBidAmount = existingBid.bid_amount;
      isUpdate = true;

      const { error: updateError } = await supabase
        .from('auction_bids')
        .update({
          bid_amount: bidAmount,
          created_at: new Date().toISOString()
        })
        .eq('id', existingBid.id);

      if (updateError) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Error al actualizar la puja: ' + updateError.message
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

    } else {
      // CREAR nueva puja
      const { error: insertError } = await supabase
        .from('auction_bids')
        .insert({
          auction_id: auctionId,
          bidder_id: userId,
          bid_amount: bidAmount,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Error al crear la puja: ' + insertError.message
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Obtener todas las pujas actuales para determinar el ganador
    const { data: allBids, error: bidsError } = await supabase
      .from('auction_bids')
      .select('bidder_id, bid_amount, created_at')
      .eq('auction_id', auctionId)
      .order('created_at', { ascending: true }); // Ordenar por fecha ascendente para manejar empates

    if (bidsError) {
      console.error('Error getting all bids:', bidsError);
    }

    // En un sistema de subasta ciega, min_bid nunca cambia
    // Solo determinamos quién tiene la puja ganadora actual
    let currentWinner = null;
    let winningBid = 0;

    if (allBids && allBids.length > 0) {
      // Obtener la última puja de cada usuario
      const latestBidsByUser = new Map();
      allBids.forEach(bid => {
        if (!latestBidsByUser.has(bid.bidder_id)) {
          latestBidsByUser.set(bid.bidder_id, bid);
        }
      });

      // Encontrar la puja ganadora (más alta, y en caso de empate, la más antigua)
      for (const [bidderUserId, bid] of latestBidsByUser) {
        if (bid.bid_amount > winningBid || 
            (bid.bid_amount === winningBid && (!currentWinner || new Date(bid.created_at) < new Date(currentWinner.created_at)))) {
          currentWinner = bid;
          winningBid = bid.bid_amount;
        }
      }
    }

    // Actualizar SOLO la información del ganador actual, NO el min_bid
    if (currentWinner && (
        currentWinner.bid_amount !== auction.current_bid || 
        currentWinner.bidder_id !== auction.current_bidder_id
    )) {
      await supabase
        .from('market_auctions')
        .update({
          current_bid: currentWinner.bid_amount,
          current_bidder_id: currentWinner.bidder_id
          // NO actualizamos min_bid - se mantiene fijo
        })
        .eq('id', auctionId);
    }

    // Determinar si este usuario está ganando actualmente
    const isCurrentWinner = currentWinner && currentWinner.bidder_id === userId;

    // Respuesta exitosa
    return new Response(JSON.stringify({ 
      success: true,
      message: isUpdate ? 'Puja actualizada con éxito' : 'Puja registrada con éxito',
      userBid: bidAmount,
      previousBid: previousBidAmount,
      isCurrentWinner: isCurrentWinner, // Cambiado de isHighestBid
      currentWinningBid: winningBid,
      newMinBid: auction.min_bid, // SIEMPRE devolver la min_bid original, sin cambios
      bidType: isUpdate ? 'updated' : 'new',
      totalBids: allBids ? new Set(allBids.map(b => b.bidder_id)).size : 1
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
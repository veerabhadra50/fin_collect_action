import { getSupabase } from '../config/supabase.js';
import { notifyAuctionScheduled, notifyAuctionResult } from '../services/notifyService.js';

const db = () => getSupabase();

// Attach winner member info without relying on a PostgREST FK embed
// (works even if the winner_member_id relationship isn't in the schema cache).
async function attachWinners(rows) {
  const ids = [...new Set(rows.map(r => r.winner_member_id).filter(Boolean))];
  if (ids.length === 0) return rows.map(r => ({ ...r, members: null }));
  const { data: members } = await db()
    .from('members')
    .select('id, name, member_code')
    .in('id', ids);
  const map = Object.fromEntries((members || []).map(m => [m.id, m]));
  return rows.map(r => ({ ...r, members: r.winner_member_id ? map[r.winner_member_id] || null : null }));
}

// POST /api/auctions  (Admin schedules an auction with date & time)
export const createAuction = async (req, res) => {
  try {
    const { group_id, month_number, auction_date, auction_time, notes } = req.body;
    if (!group_id || !month_number || !auction_date || !auction_time) {
      return res.status(400).json({ success: false, message: 'group_id, month_number, auction_date, auction_time required' });
    }

    const scheduled_at = new Date(`${auction_date}T${auction_time}`).toISOString();
    const video_room_id = `fincollect-auction-${group_id.slice(0, 8)}-m${month_number}`;

    const { data, error } = await db()
      .from('auctions')
      .insert([{
        group_id, month_number, auction_date, auction_time,
        scheduled_at, video_room_id, notes, status: 'scheduled',
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, message: error.message });

    // Fire-and-forget reminder to members of the group
    notifyAuctionScheduled(data).catch(() => {});

    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/auctions  (list, optional ?group_id= &status= )
export const listAuctions = async (req, res) => {
  try {
    const { group_id, status } = req.query;
    let q = db()
      .from('auctions')
      .select('*, chit_groups(group_code, monthly_amount)')
      .order('scheduled_at', { ascending: false });
    if (group_id) q = q.eq('group_id', group_id);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return res.status(400).json({ success: false, message: error.message });
    const withWinner = await attachWinners(data || []);
    res.json({ success: true, count: withWinner.length, data: withWinner });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/auctions/upcoming?member_id=  (auctions for groups a member belongs to)
export const memberUpcoming = async (req, res) => {
  try {
    const { member_id } = req.query;
    if (!member_id) return res.status(400).json({ success: false, message: 'member_id required' });

    const { data: memberships } = await db()
      .from('chit_group_members')
      .select('group_id')
      .eq('member_id', member_id);

    const groupIds = (memberships || []).map(m => m.group_id);
    if (groupIds.length === 0) return res.json({ success: true, count: 0, data: [] });

    const { data, error } = await db()
      .from('auctions')
      .select('*, chit_groups(group_code, monthly_amount)')
      .in('group_id', groupIds)
      .in('status', ['scheduled', 'live'])
      .order('scheduled_at', { ascending: true });

    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, count: data.length, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/auctions/:id  (full detail with bids + highest)
export const getAuction = async (req, res) => {
  try {
    const { data, error } = await db()
      .from('auctions')
      .select('*, chit_groups(group_code, monthly_amount)')
      .eq('id', req.params.id)
      .single();
    if (error) return res.status(404).json({ success: false, message: 'Auction not found' });
    const [withWinner] = await attachWinners([data]);
    Object.assign(data, withWinner);

    const { data: bids } = await db()
      .from('auction_bids')
      .select('*, members(name, member_code)')
      .eq('auction_id', req.params.id)
      .eq('is_valid', true)
      .order('amount', { ascending: false });

    res.json({ success: true, data: { ...data, bids: bids || [], highest_bid: bids?.[0] || null } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/auctions/:id/start  (Admin starts the live video + chat session)
export const startAuction = async (req, res) => {
  try {
    const { data, error } = await db()
      .from('auctions')
      .update({ status: 'live', started_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/auctions/:id/close  (Admin closes bidding, before announcing)
export const closeAuction = async (req, res) => {
  try {
    const { data, error } = await db()
      .from('auctions')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/auctions/:id/announce  (Admin announces winner + amount)
export const announceWinner = async (req, res) => {
  try {
    const { winner_member_id, winning_bid, announced_by } = req.body;

    // If not provided, auto-pick highest valid bid
    let winner = winner_member_id;
    let amount = winning_bid;
    if (!winner) {
      const { data: top } = await db()
        .from('auction_bids')
        .select('member_id, amount')
        .eq('auction_id', req.params.id)
        .eq('is_valid', true)
        .order('amount', { ascending: false })
        .limit(1)
        .single();
      if (top) { winner = top.member_id; amount = top.amount; }
    }

    const { data, error } = await db()
      .from('auctions')
      .update({
        status: 'announced',
        winner_member_id: winner || null,
        winning_bid: amount || null,
        announced_at: new Date().toISOString(),
        announced_by: announced_by || null,
      })
      .eq('id', req.params.id)
      .select('*, chit_groups(group_code)')
      .single();

    if (error) return res.status(400).json({ success: false, message: error.message });

    const [withWinner] = await attachWinners([data]);
    Object.assign(data, withWinner);

    notifyAuctionResult(data).catch(() => {});
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/auctions/:id/cancel
export const cancelAuction = async (req, res) => {
  try {
    const { data, error } = await db()
      .from('auctions')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

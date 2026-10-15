import { getSupabase } from '../config/supabase.js';

const db = () => getSupabase();

// POST /api/auctions/:id/bids  (member places a bid)
export const placeBid = async (req, res) => {
  try {
    const auction_id = req.params.id;
    const { member_id, amount } = req.body;
    if (!member_id || amount == null) {
      return res.status(400).json({ success: false, message: 'member_id and amount required' });
    }

    // Auction must be live to accept bids
    const { data: auction } = await db()
      .from('auctions')
      .select('id, status')
      .eq('id', auction_id)
      .single();
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });
    if (auction.status !== 'live') {
      return res.status(400).json({ success: false, message: 'Auction is not live' });
    }

    const { data, error } = await db()
      .from('auction_bids')
      .insert([{ auction_id, member_id, amount: Number(amount) }])
      .select('*, members(name, member_code)')
      .single();

    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/auctions/:id/bids  (list all valid bids, highest first — member-to-member view)
export const listBids = async (req, res) => {
  try {
    const { data, error } = await db()
      .from('auction_bids')
      .select('*, members(name, member_code)')
      .eq('auction_id', req.params.id)
      .eq('is_valid', true)
      .order('amount', { ascending: false });
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, count: data.length, highest_bid: data[0] || null, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/auctions/bids/:bidId/invalidate  (admin voids a bid)
export const invalidateBid = async (req, res) => {
  try {
    const { data, error } = await db()
      .from('auction_bids')
      .update({ is_valid: false })
      .eq('id', req.params.bidId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

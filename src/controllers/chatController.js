import { getSupabase } from '../config/supabase.js';

const db = () => getSupabase();

// POST /api/auctions/:id/messages  (send a chat message during the live auction)
export const sendMessage = async (req, res) => {
  try {
    const auction_id = req.params.id;
    const { sender_id, sender_type, sender_name, message } = req.body;
    if (!sender_id || !message) {
      return res.status(400).json({ success: false, message: 'sender_id and message required' });
    }

    const { data, error } = await db()
      .from('auction_messages')
      .insert([{
        auction_id,
        sender_id,
        sender_type: sender_type || 'member',
        sender_name: sender_name || null,
        message,
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/auctions/:id/messages  (poll chat history, oldest first)
export const listMessages = async (req, res) => {
  try {
    const { after } = req.query; // optional ISO timestamp for incremental polling
    let q = db()
      .from('auction_messages')
      .select('*')
      .eq('auction_id', req.params.id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (after) q = q.gt('created_at', after);
    const { data, error } = await q;
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, count: data.length, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

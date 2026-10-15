import { getSupabase } from '../config/supabase.js';

const NOTIF_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5003';
const db = () => getSupabase();

// Send one notification via the notification microservice
async function send({ user_id, user_type, title, body, type, data }) {
  try {
    await fetch(`${NOTIF_URL}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, user_type, title, body, type, data }),
    });
  } catch (err) {
    console.error('notify send failed:', err.message);
  }
}

// Get all member ids belonging to a group
async function groupMemberIds(group_id) {
  const { data } = await db()
    .from('chit_group_members')
    .select('member_id')
    .eq('group_id', group_id);
  return (data || []).map(m => m.member_id);
}

// Notify all members that an auction is scheduled
export async function notifyAuctionScheduled(auction) {
  const { data: group } = await db()
    .from('chit_groups')
    .select('group_code')
    .eq('id', auction.group_id)
    .single();

  const ids = await groupMemberIds(auction.group_id);
  const when = `${auction.auction_date} ${auction.auction_time}`;
  for (const id of ids) {
    await send({
      user_id: id,
      user_type: 'member',
      title: 'Auction Scheduled',
      body: `Auction for ${group?.group_code || 'your group'} Month ${auction.month_number} is on ${when}.`,
      type: 'auction_reminder',
      data: { auction_id: auction.id, group_id: auction.group_id },
    });
  }
}

// Notify members + admin about the auction result
export async function notifyAuctionResult(auction) {
  const winnerName = auction.members?.name || 'a member';
  const amount = Number(auction.winning_bid || 0).toLocaleString('en-IN');
  const ids = await groupMemberIds(auction.group_id);

  for (const id of ids) {
    await send({
      user_id: id,
      user_type: 'member',
      title: 'Auction Result',
      body: `${winnerName} won the auction for ${auction.chit_groups?.group_code || 'the group'} with a bid of Rs.${amount}.`,
      type: 'auction_reminder',
      data: { auction_id: auction.id, group_id: auction.group_id },
    });
  }

  // Admin notification
  await send({
    user_id: null,
    user_type: 'admin',
    title: 'Auction Announced',
    body: `${winnerName} won ${auction.chit_groups?.group_code || 'group'} Month ${auction.month_number} — Rs.${amount}.`,
    type: 'auction_reminder',
    data: { auction_id: auction.id },
  });
}

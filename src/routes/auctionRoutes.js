import { Router } from 'express';
import {
  createAuction, listAuctions, memberUpcoming, getAuction,
  startAuction, closeAuction, announceWinner, cancelAuction,
} from '../controllers/auctionController.js';
import { placeBid, listBids, invalidateBid } from '../controllers/bidController.js';
import { sendMessage, listMessages } from '../controllers/chatController.js';

const router = Router();

// ── Auctions ──────────────────────────────────────────────
router.post('/', createAuction);                 // Admin: schedule
router.get('/', listAuctions);                    // Admin: list all
router.get('/upcoming', memberUpcoming);          // Member: upcoming for my groups
router.get('/:id', getAuction);                   // Detail + bids + highest

router.patch('/:id/start', startAuction);         // Admin: go live (video + chat)
router.patch('/:id/close', closeAuction);         // Admin: stop bidding
router.patch('/:id/announce', announceWinner);    // Admin: announce result
router.patch('/:id/cancel', cancelAuction);       // Admin: cancel

// ── Bids ──────────────────────────────────────────────────
router.post('/:id/bids', placeBid);               // Member: place bid
router.get('/:id/bids', listBids);                // All: see bids (member-to-member)
router.patch('/bids/:bidId/invalidate', invalidateBid); // Admin: void a bid

// ── Chat ──────────────────────────────────────────────────
router.post('/:id/messages', sendMessage);        // Send chat message
router.get('/:id/messages', listMessages);        // Poll chat history

export default router;

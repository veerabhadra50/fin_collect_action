import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import auctionRoutes from './src/routes/auctionRoutes.js';

const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors());
app.use(express.json());

app.get('/', (_, res) => res.json({
  status: 'FinCollect Auction (Action) Service running',
  version: '1.0.0',
  port: PORT,
  routes: {
    scheduleAuction: 'POST /api/auctions',
    listAuctions:    'GET  /api/auctions?group_id=&status=',
    memberUpcoming:  'GET  /api/auctions/upcoming?member_id=',
    auctionDetail:   'GET  /api/auctions/:id',
    startAuction:    'PATCH /api/auctions/:id/start',
    closeAuction:    'PATCH /api/auctions/:id/close',
    announceWinner:  'PATCH /api/auctions/:id/announce',
    cancelAuction:   'PATCH /api/auctions/:id/cancel',
    placeBid:        'POST /api/auctions/:id/bids',
    listBids:        'GET  /api/auctions/:id/bids',
    invalidateBid:   'PATCH /api/auctions/bids/:bidId/invalidate',
    sendMessage:     'POST /api/auctions/:id/messages',
    listMessages:    'GET  /api/auctions/:id/messages?after=',
  },
}));

app.use('/api/auctions', auctionRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Auction Service -> http://localhost:${PORT}`);
});

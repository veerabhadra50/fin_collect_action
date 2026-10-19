-- ================================================================
-- RUN THIS ENTIRE BLOCK in Supabase SQL Editor (select all → Run)
-- Adds the live-auction columns to the existing `auctions` table.
-- ================================================================

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS auction_time     TIME;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS scheduled_at     TIMESTAMPTZ;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS video_room_id    TEXT;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS started_at       TIMESTAMPTZ;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS closed_at        TIMESTAMPTZ;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS winner_member_id UUID REFERENCES members(id);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS winning_bid      NUMERIC(12,2);
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS announced_at     TIMESTAMPTZ;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS announced_by     UUID;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS notes            TEXT;

ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_status_check;
ALTER TABLE auctions
  ADD CONSTRAINT auctions_status_check
  CHECK (status IN ('scheduled', 'live', 'closed', 'announced', 'cancelled', 'done'));

-- bids + messages tables
CREATE TABLE IF NOT EXISTS auction_bids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id  UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  is_valid    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auction_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id  UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  sender_type TEXT NOT NULL DEFAULT 'member',
  sender_name TEXT,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- VERIFY: this SELECT must list scheduled_at, auction_time, video_room_id, etc.
SELECT column_name FROM information_schema.columns
WHERE table_name = 'auctions' ORDER BY ordinal_position;

-- refresh API cache
NOTIFY pgrst, 'reload schema';

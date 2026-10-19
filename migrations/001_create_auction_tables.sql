-- ================================================================
-- FinCollect Auction (Action) Service — Supabase Migration
-- Run in: Supabase Dashboard → SQL Editor → Run
--
-- NOTE: The main backend already creates a basic `auctions` table
-- (columns: auction_date, winner_id, bid_amount, status).
-- This migration UPGRADES that existing table with the extra
-- columns the live-auction service needs, and creates the
-- bids + messages tables. It is safe to run multiple times.
-- ================================================================

-- Shared helper (already created by the main backend). Recreate defensively.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;


-- ─────────────────────────────────────────────────────────────────
-- 1. AUCTIONS — create if missing, otherwise add the new columns
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auctions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES chit_groups(id) ON DELETE CASCADE,
  month_number  INT  NOT NULL,
  auction_date  DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'scheduled',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (group_id, month_number)
);

-- Add live-auction columns (safe if they already exist)
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

-- The existing table restricts status to ('scheduled','done','cancelled').
-- Widen it to allow the live-auction lifecycle.
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_status_check;
ALTER TABLE auctions
  ADD CONSTRAINT auctions_status_check
  CHECK (status IN ('scheduled', 'live', 'closed', 'announced', 'cancelled', 'done'));

CREATE INDEX IF NOT EXISTS idx_auctions_group  ON auctions(group_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);

DROP TRIGGER IF EXISTS auctions_updated_at ON auctions;
CREATE TRIGGER auctions_updated_at
  BEFORE UPDATE ON auctions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────────────────────────
-- 2. AUCTION_BIDS  (member-to-member live bids)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auction_bids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id  UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  is_valid    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bids_auction ON auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_member  ON auction_bids(member_id);


-- ─────────────────────────────────────────────────────────────────
-- 3. AUCTION_MESSAGES  (live chat during the auction)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auction_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id  UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  sender_type TEXT NOT NULL DEFAULT 'member'
                CHECK (sender_type IN ('member', 'admin', 'worker')),
  sender_name TEXT,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msgs_auction ON auction_messages(auction_id);


-- ─────────────────────────────────────────────────────────────────
-- 4. Reload PostgREST schema cache (fixes "column not found in cache")
-- ─────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

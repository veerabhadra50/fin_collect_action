-- ================================================================
-- Diagnostic + force schema-cache reload
-- Run in Supabase SQL Editor
-- ================================================================

-- 1. Confirm the columns actually exist on the table.
--    You should see auction_time, video_room_id, winner_member_id, etc.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'auctions'
ORDER BY ordinal_position;

-- 2. If auction_time is listed above but the API still errors,
--    it is purely a PostgREST schema-cache problem. Force a reload:
NOTIFY pgrst, 'reload schema';

-- 3. Belt-and-suspenders: some hosted projects only pick up the
--    reload after a trivial DDL change. This harmless comment change
--    bumps the schema and forces PostgREST to re-introspect.
COMMENT ON TABLE auctions IS 'FinCollect auctions (live auction service) - reloaded';

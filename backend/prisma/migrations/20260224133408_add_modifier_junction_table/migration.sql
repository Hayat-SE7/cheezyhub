-- ─────────────────────────────────────────────────────
--  Migration: add_modifier_group_item_fk
--
--  WHY THIS IS NEEDED:
--  The schema has modifier_groups.menuItemId as a required FK,
--  but the database column doesn't exist yet. Prisma can't auto-add
--  a NOT NULL column to a table with existing rows (no default value).
--
--  WHAT THIS DOES:
--  Step 1 — Adds menuItemId as nullable (safe for existing rows).
--  Step 2 — Deletes any orphaned modifier groups and their child
--            modifiers that have no menuItemId value. These rows
--            were created before the FK was enforced — they have no
--            valid owner and cannot be migrated. Re-create them in
--            the Admin panel after running this migration.
--  Step 3 — Makes the column NOT NULL now that no null rows remain.
--  Step 4 — Adds the foreign key constraint with CASCADE delete.
-- ─────────────────────────────────────────────────────

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='modifier_groups' AND column_name='menuItemId') THEN
    ALTER TABLE "modifier_groups" ADD COLUMN "menuItemId" TEXT;
  END IF;
END $$;

-- Step 2: Clean up orphaned rows (Safety cleanup for foreign key)
DELETE FROM "modifiers"
  WHERE "modifierGroupId" IN (
    SELECT id FROM "modifier_groups" WHERE "menuItemId" IS NULL
  );

DELETE FROM "modifier_groups"
  WHERE "menuItemId" IS NULL;

-- Step 3: Make the column NOT NULL now that it is clean
ALTER TABLE "modifier_groups"
  ALTER COLUMN "menuItemId" SET NOT NULL;

-- Step 4: Add the foreign key constraint
-- We use a DROP/CREATE cycle to ensure no duplicate constraint errors
ALTER TABLE "modifier_groups" 
  DROP CONSTRAINT IF EXISTS "modifier_groups_menuItemId_fkey";

ALTER TABLE "modifier_groups"
  ADD CONSTRAINT "modifier_groups_menuItemId_fkey"
  FOREIGN KEY ("menuItemId")
  REFERENCES "menu_items"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
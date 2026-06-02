-- AddCheckConstraint: checklist_item_checked_xor_napplicable
-- Prevents a ChecklistItem from being both `checked` and `notApplicable`
-- simultaneously. The Zod refinement on `editChecklistItemSchema` keeps
-- the action layer honest; this CHECK is the DB-side belt to its braces.
-- See proposal §3 #10 / plan Task 16.3.
ALTER TABLE "ChecklistItem"
ADD CONSTRAINT checklist_item_checked_xor_napplicable
CHECK (NOT ("checked" AND "notApplicable"));

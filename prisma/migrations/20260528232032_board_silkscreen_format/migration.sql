ALTER TABLE "Board"
ADD CONSTRAINT board_silkscreen_format CHECK (
  "silkscreenHash" IS NULL OR "silkscreenHash" ~* '^g?[0-9a-f]{7,40}$'
);

-- Library review items (step 4): a QuizItem sourced from a mini-lesson has no
-- stage, so QuizItem.stage becomes nullable. Additive + widening, safe against the
-- running deploy (existing guide rows keep their non-null stage).

ALTER TABLE "QuizItem" ALTER COLUMN "stage" DROP NOT NULL;

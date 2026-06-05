-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "KicadLibSymbol" (
    "libId" TEXT NOT NULL,
    "lib" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT,
    "description" TEXT,
    "datasheet" TEXT,
    "fpFilters" TEXT,

    CONSTRAINT "KicadLibSymbol_pkey" PRIMARY KEY ("libId")
);

-- CreateTable
CREATE TABLE "KicadLibFootprint" (
    "libId" TEXT NOT NULL,
    "lib" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT,
    "padCount" INTEGER,

    CONSTRAINT "KicadLibFootprint_pkey" PRIMARY KEY ("libId")
);

-- CreateTable
CREATE TABLE "KicadSymbolDefCache" (
    "libId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KicadSymbolDefCache_pkey" PRIMARY KEY ("libId")
);

-- CreateIndex
CREATE INDEX "KicadLibSymbol_lib_idx" ON "KicadLibSymbol"("lib");

-- CreateIndex
CREATE INDEX "KicadLibFootprint_lib_idx" ON "KicadLibFootprint"("lib");

-- CreateIndex (pg_trgm GIN — search ranking; expression MUST match the search query)
CREATE INDEX "KicadLibSymbol_search_trgm" ON "KicadLibSymbol"
  USING GIN ((coalesce("name",'') || ' ' || coalesce("keywords",'') || ' ' || coalesce("description",'')) gin_trgm_ops);

-- CreateIndex (pg_trgm GIN)
CREATE INDEX "KicadLibFootprint_search_trgm" ON "KicadLibFootprint"
  USING GIN ((coalesce("name",'') || ' ' || coalesce("description",'') || ' ' || coalesce("tags",'')) gin_trgm_ops);

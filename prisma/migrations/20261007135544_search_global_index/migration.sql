-- Global search (Ctrl+K): relevance index without LIKE scans.
-- unaccent + pg_trgm are trusted contrib extensions (no superuser needed).
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() is STABLE (it depends on the dictionary search path); generated
-- columns and indexes need an IMMUTABLE wrapper pinned to the dictionary.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- CreateTable
CREATE TABLE "search_documents" (
    "workspace_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "module" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'PUBLIC',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT,
    "keywords" TEXT NOT NULL DEFAULT '',
    "codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "path" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "indexed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Folded title: exact/prefix comparisons and the trigram (typo) index.
    "title_norm" TEXT GENERATED ALWAYS AS (lower(f_unaccent("title"))) STORED,
    -- A = title + codes/keywords, B = subtitle, C = body.
    "search_vector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('portuguese'::regconfig, f_unaccent(coalesce("title", ''))), 'A') ||
        setweight(to_tsvector('simple'::regconfig, f_unaccent(coalesce("keywords", ''))), 'A') ||
        setweight(to_tsvector('portuguese'::regconfig, f_unaccent(coalesce("subtitle", ''))), 'B') ||
        setweight(to_tsvector('portuguese'::regconfig, f_unaccent(coalesce("body", ''))), 'C')
    ) STORED,

    CONSTRAINT "search_documents_pkey" PRIMARY KEY ("workspace_id","entity_type","entity_id")
);

-- CreateIndex
CREATE INDEX "search_documents_search_vector_idx" ON "search_documents" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "search_documents_title_norm_trgm_idx" ON "search_documents" USING GIN ("title_norm" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "search_documents_codes_idx" ON "search_documents" USING GIN ("codes");

-- CreateIndex
CREATE INDEX "search_documents_workspace_id_entity_type_indexed_at_idx" ON "search_documents"("workspace_id", "entity_type", "indexed_at");

-- AddForeignKey
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

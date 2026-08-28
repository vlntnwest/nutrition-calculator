ALTER TABLE "tracks" ADD COLUMN "profile" jsonb;

UPDATE "tracks" SET "profile" = (
  SELECT jsonb_agg(jsonb_build_object('d', p->'d', 'ele', p->'ele') ORDER BY ord)
  FROM jsonb_array_elements("points") WITH ORDINALITY AS t(p, ord)
);

ALTER TABLE "tracks" ALTER COLUMN "profile" SET NOT NULL;
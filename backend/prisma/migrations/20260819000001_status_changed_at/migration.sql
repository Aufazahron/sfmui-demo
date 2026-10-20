ALTER TABLE "Node" ADD COLUMN "statusChangedAt" TIMESTAMPTZ(3);

UPDATE "Node" AS n
SET "statusChangedAt" = COALESCE(
  (
    SELECT dl."createdAt"
    FROM "DeviceLog" AS dl
    WHERE dl."nodeId" = n.id
      AND dl."type"::text = n."status"::text
    ORDER BY dl."createdAt" DESC
    LIMIT 1
  ),
  n."createdAt"
);

ALTER TABLE "Node" ALTER COLUMN "statusChangedAt" SET NOT NULL;
ALTER TABLE "Node" ALTER COLUMN "statusChangedAt" SET DEFAULT CURRENT_TIMESTAMP;

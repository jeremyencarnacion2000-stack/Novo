-- Surface classification only: no device fingerprint, hardware identifier, or
-- raw user-agent is retained. Existing browser sessions are conservatively
-- classified as desktop web until future activity supplies its surface.
ALTER TABLE "DeviceActivityEvent"
ADD COLUMN "surface" TEXT NOT NULL DEFAULT 'web_desktop';

CREATE INDEX "DeviceActivityEvent_userId_surface_startedAt_idx"
ON "DeviceActivityEvent"("userId", "surface", "startedAt");

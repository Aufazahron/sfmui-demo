-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'operator');
CREATE TYPE "NodeStatus" AS ENUM ('online', 'offline', 'warning');
CREATE TYPE "ValveState" AS ENUM ('open', 'closed');
CREATE TYPE "NodeMode" AS ENUM ('manual', 'automatic');
CREATE TYPE "TelemetrySource" AS ENUM ('minute', 'backlog');
CREATE TYPE "DeviceLogType" AS ENUM ('online', 'offline', 'valve', 'limit', 'schedule', 'system');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "parentId" TEXT,
    "status" "NodeStatus" NOT NULL DEFAULT 'offline',
    "valveState" "ValveState" NOT NULL DEFAULT 'closed',
    "mode" "NodeMode" NOT NULL DEFAULT 'manual',
    "dailyLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "schedule" JSONB NOT NULL DEFAULT '{"active":false,"days":[],"openTime":"00:00","closeTime":"00:00"}',
    "lastSeenAt" TIMESTAMP(3),
    "lastOdometer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastFlowrate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastTelemetrySeq" INTEGER NOT NULL DEFAULT 0,
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "configAckedVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Node_deviceId_key" ON "Node"("deviceId");

CREATE TABLE "TelemetryReading" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "flowrateAvg" DOUBLE PRECISION NOT NULL,
    "odometer" DOUBLE PRECISION NOT NULL,
    "seq" INTEGER NOT NULL,
    "source" "TelemetrySource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelemetryReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelemetryReading_nodeId_recordedAt_key" ON "TelemetryReading"("nodeId", "recordedAt");
CREATE INDEX "TelemetryReading_nodeId_recordedAt_idx" ON "TelemetryReading"("nodeId", "recordedAt" DESC);

CREATE TABLE "DeviceLog" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" "DeviceLogType" NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeviceLog_createdAt_idx" ON "DeviceLog"("createdAt" DESC);

CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt" DESC);

-- Foreign keys
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Node" ADD CONSTRAINT "Node_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Node"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelemetryReading" ADD CONSTRAINT "TelemetryReading_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceLog" ADD CONSTRAINT "DeviceLog_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

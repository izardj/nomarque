-- CreateEnum
CREATE TYPE "WorldStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReignStatus" AS ENUM ('SCHEDULED', 'RUNNING', 'FUNERALS', 'ENDED');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('UPPER_EGYPT', 'MIDDLE_EGYPT', 'DELTA');

-- CreateEnum
CREATE TYPE "FloodLevel" AS ENUM ('LOW', 'GOOD', 'HIGH');

-- CreateEnum
CREATE TYPE "Zone" AS ENUM ('DESERT', 'CITY', 'BLACK_LAND', 'RIVER');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DELIVERED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoyalOrderKind" AS ENUM ('DAILY', 'WEEKLY', 'MONUMENT');

-- CreateTable
CREATE TABLE "Player" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLinkToken" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerId" UUID,

    CONSTRAINT "MagicLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dynasty" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prestige" INTEGER NOT NULL DEFAULT 0,
    "cosmetics" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dynasty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "World" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL,
    "status" "WorldStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reign" (
    "id" UUID NOT NULL,
    "worldId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "ReignStatus" NOT NULL DEFAULT 'SCHEDULED',
    "dataVersion" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "monumentProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NileYear" (
    "id" UUID NOT NULL,
    "reignId" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "floodLevel" "FloodLevel" NOT NULL,
    "revealedAt" TIMESTAMP(3),

    CONSTRAINT "NileYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nome" (
    "id" UUID NOT NULL,
    "reignId" UUID NOT NULL,
    "dynastyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "region" "Region" NOT NULL,
    "deben" DOUBLE PRECISION NOT NULL,
    "favor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "computedAt" DOUBLE PRECISION NOT NULL,
    "rulesState" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" UUID NOT NULL,
    "nomeId" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "zone" "Zone" NOT NULL,
    "buildingType" TEXT,
    "houseLevel" INTEGER,
    "houseCount" INTEGER NOT NULL DEFAULT 0,
    "workers" INTEGER NOT NULL DEFAULT 0,
    "buildEndsAt" DOUBLE PRECISION,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "nomeId" UUID NOT NULL,
    "resource" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("nomeId","resource")
);

-- CreateTable
CREATE TABLE "MarketOrder" (
    "id" UUID NOT NULL,
    "worldId" UUID NOT NULL,
    "port" TEXT NOT NULL,
    "nomeId" UUID,
    "resource" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" UUID NOT NULL,
    "buyOrderId" UUID NOT NULL,
    "sellOrderId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "issuerNomeId" UUID NOT NULL,
    "takerNomeId" UUID,
    "resource" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoyalOrder" (
    "id" UUID NOT NULL,
    "reignId" UUID NOT NULL,
    "kind" "RoyalOrderKind" NOT NULL,
    "resource" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "favorPerUnit" DOUBLE PRECISION NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoyalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCardDraw" (
    "id" UUID NOT NULL,
    "nomeId" UUID NOT NULL,
    "cardId" TEXT NOT NULL,
    "drawnAt" DOUBLE PRECISION NOT NULL,
    "expiresAt" DOUBLE PRECISION NOT NULL,
    "choice" TEXT,
    "resolvedAt" DOUBLE PRECISION,

    CONSTRAINT "EventCardDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expedition" (
    "id" UUID NOT NULL,
    "nomeId" UUID NOT NULL,
    "destination" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "departsAt" DOUBLE PRECISION NOT NULL,
    "returnsAt" DOUBLE PRECISION NOT NULL,
    "outcome" JSONB,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "Expedition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" UUID NOT NULL,
    "nomeId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_email_key" ON "Player"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLinkToken_tokenHash_key" ON "MagicLinkToken"("tokenHash");

-- CreateIndex
CREATE INDEX "MagicLinkToken_email_createdAt_idx" ON "MagicLinkToken"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_playerId_idx" ON "Session"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Dynasty_playerId_key" ON "Dynasty"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "World_name_key" ON "World"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Reign_worldId_number_key" ON "Reign"("worldId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "NileYear_reignId_index_key" ON "NileYear"("reignId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Nome_reignId_dynastyId_key" ON "Nome"("reignId", "dynastyId");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_nomeId_slot_key" ON "Parcel"("nomeId", "slot");

-- CreateIndex
CREATE INDEX "MarketOrder_worldId_port_resource_side_status_unitPrice_cre_idx" ON "MarketOrder"("worldId", "port", "resource", "side", "status", "unitPrice", "createdAt");

-- CreateIndex
CREATE INDEX "MarketOrder_nomeId_status_idx" ON "MarketOrder"("nomeId", "status");

-- CreateIndex
CREATE INDEX "Trade_executedAt_idx" ON "Trade"("executedAt");

-- CreateIndex
CREATE INDEX "Contract_status_deadline_idx" ON "Contract"("status", "deadline");

-- CreateIndex
CREATE INDEX "RoyalOrder_reignId_endsAt_idx" ON "RoyalOrder"("reignId", "endsAt");

-- CreateIndex
CREATE INDEX "EventCardDraw_nomeId_resolvedAt_idx" ON "EventCardDraw"("nomeId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventCardDraw_nomeId_cardId_drawnAt_key" ON "EventCardDraw"("nomeId", "cardId", "drawnAt");

-- CreateIndex
CREATE INDEX "Expedition_nomeId_returnsAt_idx" ON "Expedition"("nomeId", "returnsAt");

-- CreateIndex
CREATE INDEX "ActionLog_nomeId_createdAt_idx" ON "ActionLog"("nomeId", "createdAt");

-- AddForeignKey
ALTER TABLE "MagicLinkToken" ADD CONSTRAINT "MagicLinkToken_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dynasty" ADD CONSTRAINT "Dynasty_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reign" ADD CONSTRAINT "Reign_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NileYear" ADD CONSTRAINT "NileYear_reignId_fkey" FOREIGN KEY ("reignId") REFERENCES "Reign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nome" ADD CONSTRAINT "Nome_reignId_fkey" FOREIGN KEY ("reignId") REFERENCES "Reign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nome" ADD CONSTRAINT "Nome_dynastyId_fkey" FOREIGN KEY ("dynastyId") REFERENCES "Dynasty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_nomeId_fkey" FOREIGN KEY ("nomeId") REFERENCES "Nome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_nomeId_fkey" FOREIGN KEY ("nomeId") REFERENCES "Nome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_nomeId_fkey" FOREIGN KEY ("nomeId") REFERENCES "Nome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_buyOrderId_fkey" FOREIGN KEY ("buyOrderId") REFERENCES "MarketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_sellOrderId_fkey" FOREIGN KEY ("sellOrderId") REFERENCES "MarketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_issuerNomeId_fkey" FOREIGN KEY ("issuerNomeId") REFERENCES "Nome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_takerNomeId_fkey" FOREIGN KEY ("takerNomeId") REFERENCES "Nome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyalOrder" ADD CONSTRAINT "RoyalOrder_reignId_fkey" FOREIGN KEY ("reignId") REFERENCES "Reign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCardDraw" ADD CONSTRAINT "EventCardDraw_nomeId_fkey" FOREIGN KEY ("nomeId") REFERENCES "Nome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_nomeId_fkey" FOREIGN KEY ("nomeId") REFERENCES "Nome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_nomeId_fkey" FOREIGN KEY ("nomeId") REFERENCES "Nome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

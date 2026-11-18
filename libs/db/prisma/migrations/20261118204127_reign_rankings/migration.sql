-- CreateEnum
CREATE TYPE "RankingCategory" AS ENUM ('WEALTH', 'PIETY', 'ROYAL_FAVOR');

-- CreateTable
CREATE TABLE "ReignRanking" (
    "id" UUID NOT NULL,
    "reignId" UUID NOT NULL,
    "category" "RankingCategory" NOT NULL,
    "nomeId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "prestige" INTEGER NOT NULL,

    CONSTRAINT "ReignRanking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReignRanking_reignId_category_rank_idx" ON "ReignRanking"("reignId", "category", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ReignRanking_reignId_category_nomeId_key" ON "ReignRanking"("reignId", "category", "nomeId");

-- AddForeignKey
ALTER TABLE "ReignRanking" ADD CONSTRAINT "ReignRanking_reignId_fkey" FOREIGN KEY ("reignId") REFERENCES "Reign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReignRanking" ADD CONSTRAINT "ReignRanking_nomeId_fkey" FOREIGN KEY ("nomeId") REFERENCES "Nome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

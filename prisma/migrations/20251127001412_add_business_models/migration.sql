-- CreateTable
CREATE TABLE "business_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "projects" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "business_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_content_ideas" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "business_content_ideas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "business_clients" ADD CONSTRAINT "business_clients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_content_ideas" ADD CONSTRAINT "business_content_ideas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "school_grades" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "grade" DOUBLE PRECISION NOT NULL,
    "subjectId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "school_grades_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "school_grades" ADD CONSTRAINT "school_grades_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "school_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

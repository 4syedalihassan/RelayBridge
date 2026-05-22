import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const connector = await prisma.connector.findUnique({
    where: { id: params.id },
  });

  if (!connector) {
    return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const logs = await prisma.archiveLog.findMany({
    where: {
      serverId: connector.discordServerId,
      archivedAt: { gte: thirtyDaysAgo },
    },
    orderBy: { archivedAt: 'asc' },
  });

  const totalArchived = logs.length;
  const successCount = logs.filter((l) => l.status === 'success').length;
  const errorCount = logs.filter((l) => l.status === 'error').length;
  const successRate = totalArchived > 0 ? successCount / totalArchived : 0;

  const dailyMap = new Map<string, number>();
  for (const log of logs) {
    const date = log.archivedAt.toISOString().slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
  }

  const dailyVolume = Array.from(dailyMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  return NextResponse.json({
    totalArchived,
    successCount,
    errorCount,
    successRate,
    dailyVolume,
  });
}

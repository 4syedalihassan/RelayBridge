import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [serverCount, channelCount, recentLogs] = await Promise.all([
    prisma.server.count(),
    prisma.channel.count({ where: { archivingEnabled: true } }),
    prisma.archiveLog.findMany({
      orderBy: { archivedAt: 'desc' },
      take: 5,
      select: { id: true, eventType: true, status: true, archivedAt: true },
    }),
  ]);

  return NextResponse.json({
    servers: serverCount,
    activeChannels: channelCount,
    recentLogs,
    uptime: process.uptime(),
  });
}

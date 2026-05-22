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

  const connectors = await prisma.connector.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(connectors);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const connector = await prisma.connector.create({
    data: {
      name: body.name,
      description: body.description,
      discordServerId: body.discordServerId,
      discordChannelIds: body.discordChannelIds,
      grClientId: body.grClientId,
      grClientSecret: body.grClientSecret,
      grOAuthUrl: body.grOAuthUrl,
      grApiBaseUrl: body.grApiBaseUrl,
    },
  });

  return NextResponse.json(connector, { status: 201 });
}

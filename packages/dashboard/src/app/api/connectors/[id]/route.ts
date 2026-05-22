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

  return NextResponse.json(connector);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await prisma.connector.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
  }

  const body = await request.json();
  const connector = await prisma.connector.update({
    where: { id: params.id },
    data: {
      name: body.name,
      description: body.description,
      discordServerId: body.discordServerId,
      discordChannelIds: body.discordChannelIds,
      grClientId: body.grClientId,
      grClientSecret: body.grClientSecret,
      grOAuthUrl: body.grOAuthUrl,
      grApiBaseUrl: body.grApiBaseUrl,
      enabled: body.enabled,
      status: body.status,
    },
  });

  return NextResponse.json(connector);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await prisma.connector.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
  }

  await prisma.connector.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}

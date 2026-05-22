import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mappings = await prisma.userMapping.findMany({
    where: { serverId: params.id },
  });
  return NextResponse.json(mappings);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const mapping = await prisma.userMapping.upsert({
    where: { serverId_discordUserId: { serverId: params.id, discordUserId: body.discordUserId } },
    update: { corporateEmail: body.corporateEmail, discordName: body.discordName },
    create: {
      serverId: params.id,
      discordUserId: body.discordUserId,
      discordName: body.discordName,
      corporateEmail: body.corporateEmail,
    },
  });

  return NextResponse.json(mapping);
}

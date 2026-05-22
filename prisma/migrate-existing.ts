import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const server = await prisma.server.findFirst();
  const grConfig = await prisma.globalRelayConfig.findFirst();

  if (!server && !grConfig) {
    console.log('No existing data to migrate');
    return;
  }

  if (server && grConfig) {
    await prisma.connector.create({
      data: {
        name: 'Default Connector',
        description: server.name,
        discordServerId: server.id,
        discordChannelIds: '',
        grClientId: grConfig.clientId,
        grClientSecret: grConfig.clientSecret,
        grOAuthUrl: grConfig.oauthUrl,
        grApiBaseUrl: grConfig.apiBaseUrl,
        enabled: true,
        status: 'offline',
      },
    });
    console.log('Created Connector from Server and GlobalRelayConfig');
    return;
  }

  if (server && !grConfig) {
    console.warn('Warning: No GlobalRelayConfig found — creating Connector with placeholder values');
    await prisma.connector.create({
      data: {
        name: 'Default Connector',
        description: server.name,
        discordServerId: server.id,
        discordChannelIds: '',
        grClientId: '',
        grClientSecret: '',
        enabled: true,
        status: 'offline',
      },
    });
    console.log('Created Connector from Server (GR values are placeholders)');
    return;
  }

  if (!server && grConfig) {
    console.warn('Warning: No Server found — creating Connector with placeholder server values');
    await prisma.connector.create({
      data: {
        name: 'Default Connector',
        description: 'Migrated from GlobalRelayConfig',
        discordServerId: '',
        discordChannelIds: '',
        grClientId: grConfig.clientId,
        grClientSecret: grConfig.clientSecret,
        grOAuthUrl: grConfig.oauthUrl,
        grApiBaseUrl: grConfig.apiBaseUrl,
        enabled: true,
        status: 'offline',
      },
    });
    console.log('Created Connector from GlobalRelayConfig (server values are placeholders)');
    return;
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

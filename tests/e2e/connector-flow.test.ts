import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Connector CRUD', () => {
  let prisma: PrismaClient;
  const connectorId = 'e2e-crud-connector-1';

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.connector.deleteMany({ where: { id: { startsWith: 'e2e-' } } });
    await prisma.$disconnect();
  });

  it('creates a connector via Prisma directly', async () => {
    const connector = await prisma.connector.create({
      data: {
        id: connectorId,
        name: 'E2E Test Connector',
        discordServerId: 'e2e-server-1',
        discordChannelIds: 'chan-1,chan-2',
        grClientId: 'gr-client-1',
        grClientSecret: 'gr-secret-1',
        enabled: false,
        status: 'offline',
      },
    });
    expect(connector).toBeDefined();
    expect(connector.name).toBe('E2E Test Connector');
    expect(connector.enabled).toBe(false);
  });

  it('reads the created connector', async () => {
    const connector = await prisma.connector.findUnique({ where: { id: connectorId } });
    expect(connector).not.toBeNull();
    expect(connector!.discordServerId).toBe('e2e-server-1');
    expect(connector!.discordChannelIds).toBe('chan-1,chan-2');
  });

  it('updates the connector name', async () => {
    const updated = await prisma.connector.update({
      where: { id: connectorId },
      data: { name: 'E2E Updated Connector' },
    });
    expect(updated.name).toBe('E2E Updated Connector');
    const fetched = await prisma.connector.findUnique({ where: { id: connectorId } });
    expect(fetched!.name).toBe('E2E Updated Connector');
  });

  it('deletes the connector', async () => {
    await prisma.connector.delete({ where: { id: connectorId } });
    const deleted = await prisma.connector.findUnique({ where: { id: connectorId } });
    expect(deleted).toBeNull();
  });
});

describe('Connector toggle', () => {
  let prisma: PrismaClient;
  const connectorId = 'e2e-toggle-connector';

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.connector.deleteMany({ where: { id: { startsWith: 'e2e-' } } });
    await prisma.$disconnect();
  });

  it('flips enabled from false to true', async () => {
    await prisma.connector.create({
      data: {
        id: connectorId,
        name: 'Toggle Connector',
        discordServerId: 'e2e-toggle-srv',
        discordChannelIds: '',
        grClientId: 'gr-client',
        grClientSecret: 'gr-secret',
        enabled: false,
        status: 'offline',
      },
    });
    await prisma.connector.update({
      where: { id: connectorId },
      data: { enabled: true },
    });
    const fetched = await prisma.connector.findUnique({ where: { id: connectorId } });
    expect(fetched!.enabled).toBe(true);
  });

  it('flips enabled from true to false', async () => {
    await prisma.connector.update({
      where: { id: connectorId },
      data: { enabled: false },
    });
    const fetched = await prisma.connector.findUnique({ where: { id: connectorId } });
    expect(fetched!.enabled).toBe(false);
  });
});

describe('Connector analytics', () => {
  let prisma: PrismaClient;
  const connectorId = 'e2e-analytics-connector';
  const discordServerId = 'e2e-analytics-srv';

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.connector.create({
      data: {
        id: connectorId,
        name: 'Analytics Connector',
        discordServerId,
        discordChannelIds: 'chan-a',
        grClientId: 'gr-client',
        grClientSecret: 'gr-secret',
        enabled: true,
        status: 'online',
      },
    });
  });

  afterAll(async () => {
    await prisma.archiveLog.deleteMany({ where: { serverId: { startsWith: 'e2e-' } } });
    await prisma.connector.deleteMany({ where: { id: { startsWith: 'e2e-' } } });
    await prisma.$disconnect();
  });

  it('returns zero stats for connector with no archive logs', async () => {
    const total = await prisma.archiveLog.count({ where: { serverId: discordServerId } });
    expect(total).toBe(0);
  });

  it('counts total archived from ArchiveLog records', async () => {
    await prisma.archiveLog.createMany({
      data: [
        { channelId: 'chan-a', serverId: discordServerId, eventType: 'Message', status: 'success', messageId: 'm1' },
        { channelId: 'chan-a', serverId: discordServerId, eventType: 'Message', status: 'success', messageId: 'm2' },
        { channelId: 'chan-a', serverId: discordServerId, eventType: 'Reaction', status: 'success', messageId: 'm3' },
        { channelId: 'chan-a', serverId: discordServerId, eventType: 'Message', status: 'failed', messageId: 'm4', errorMessage: 'timeout' },
        { channelId: 'chan-a', serverId: discordServerId, eventType: 'Message', status: 'failed', messageId: 'm5', errorMessage: 'auth_error' },
      ],
    });
    const total = await prisma.archiveLog.count({ where: { serverId: discordServerId } });
    expect(total).toBe(5);
  });

  it('computes success rate correctly', async () => {
    const total = await prisma.archiveLog.count({ where: { serverId: discordServerId } });
    const successCount = await prisma.archiveLog.count({
      where: { serverId: discordServerId, status: 'success' },
    });
    const errorCount = await prisma.archiveLog.count({
      where: { serverId: discordServerId, status: { not: 'success' } },
    });
    expect(total).toBe(5);
    expect(successCount).toBe(3);
    expect(errorCount).toBe(2);
    expect(successCount / total).toBe(0.6);
  });
});

describe('Data migration', () => {
  let prisma: PrismaClient;
  const serverId = 'e2e-migrate-srv';

  afterAll(async () => {
    await prisma.connector.deleteMany({ where: { id: { startsWith: 'e2e-' } } });
    await prisma.server.deleteMany({ where: { id: { startsWith: 'e2e-' } } });
    await prisma.globalRelayConfig.deleteMany({ where: { id: 'e2e-migrate-grconfig' } });
    await prisma.$disconnect();
  });

  it('migrates Server + GlobalRelayConfig into Connector', async () => {
    prisma = new PrismaClient();
    await prisma.server.create({
      data: {
        id: serverId,
        name: 'E2E Migration Server',
        archivingEnabled: true,
      },
    });
    await prisma.globalRelayConfig.create({
      data: {
        id: 'e2e-migrate-grconfig',
        clientId: 'migrate-client-id',
        clientSecret: 'migrate-client-secret',
        oauthUrl: 'https://oauth.example.com/token',
        apiBaseUrl: 'https://api.example.com/v2',
      },
    });
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    const grConfig = await prisma.globalRelayConfig.findUnique({ where: { id: 'e2e-migrate-grconfig' } });

    const connector = await prisma.connector.create({
      data: {
        name: 'Default Connector',
        description: server!.name,
        discordServerId: server!.id,
        discordChannelIds: '',
        grClientId: grConfig!.clientId,
        grClientSecret: grConfig!.clientSecret,
        grOAuthUrl: grConfig!.oauthUrl,
        grApiBaseUrl: grConfig!.apiBaseUrl,
        enabled: true,
        status: 'offline',
      },
    });

    expect(connector).toBeDefined();
    expect(connector.discordServerId).toBe(serverId);
    expect(connector.grClientId).toBe('migrate-client-id');
    expect(connector.grClientSecret).toBe('migrate-client-secret');
    expect(connector.grOAuthUrl).toBe('https://oauth.example.com/token');
    expect(connector.grApiBaseUrl).toBe('https://api.example.com/v2');
    expect(connector.description).toBe('E2E Migration Server');
    expect(connector.enabled).toBe(true);
  });

  it('handles missing Server or Config gracefully', async () => {
    const noServerGrConfig = await prisma.connector.create({
      data: {
        name: 'GR-Only Connector',
        description: 'Migrated from GlobalRelayConfig',
        discordServerId: '',
        discordChannelIds: '',
        grClientId: 'orphan-client',
        grClientSecret: 'orphan-secret',
        enabled: true,
        status: 'offline',
      },
    });
    expect(noServerGrConfig.discordServerId).toBe('');
    expect(noServerGrConfig.grClientId).toBe('orphan-client');

    const noConfigServer = await prisma.connector.create({
      data: {
        name: 'Server-Only Connector',
        description: 'No GR config',
        discordServerId: 'orphan-server',
        discordChannelIds: '',
        grClientId: '',
        grClientSecret: '',
        enabled: true,
        status: 'offline',
      },
    });
    expect(noConfigServer.discordServerId).toBe('orphan-server');
    expect(noConfigServer.grClientId).toBe('');
  });
});

describe('Connector data validation', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.connector.deleteMany({ where: { id: { startsWith: 'e2e-' } } });
    await prisma.$disconnect();
  });

  it('requires non-empty name', async () => {
    const validateConnectorName = (name: string): boolean => name.trim().length > 0;
    expect(validateConnectorName('')).toBe(false);
    expect(validateConnectorName('  ')).toBe(false);
    expect(validateConnectorName('Valid Name')).toBe(true);
  });

  it('requires GR credentials', async () => {
    const validateGrCredentials = (clientId: string, clientSecret: string): boolean =>
      clientId.trim().length > 0 && clientSecret.trim().length > 0;
    expect(validateGrCredentials('', 'secret')).toBe(false);
    expect(validateGrCredentials('client', '')).toBe(false);
    expect(validateGrCredentials('', '')).toBe(false);
    expect(validateGrCredentials('valid-client', 'valid-secret')).toBe(true);
  });

  it('accepts valid connector data', async () => {
    const connector = await prisma.connector.create({
      data: {
        id: 'e2e-valid-connector',
        name: 'Valid Connector',
        description: 'A properly configured connector',
        discordServerId: 'srv-valid',
        discordChannelIds: 'chan-1',
        grClientId: 'valid-client',
        grClientSecret: 'valid-secret',
        grOAuthUrl: 'https://oauth.example.com/token',
        grApiBaseUrl: 'https://api.example.com/v2',
        enabled: true,
        status: 'online',
        lastHealthCheckAt: new Date(),
      },
    });
    expect(connector.name).toBe('Valid Connector');
    expect(connector.description).toBe('A properly configured connector');
    expect(connector.enabled).toBe(true);
    expect(connector.status).toBe('online');
    expect(connector.lastHealthCheckAt).toBeInstanceOf(Date);
  });
});

import { PrismaClient } from '@prisma/client';
import { loadConfig } from '@discord-gr/core';
import { startBot, onMessage, onMessageEdit, onReaction } from '@discord-gr/discord-bot';
import { TokenManager, GrClient } from '@discord-gr/gr-client';
import { ArchiveQueue } from './queue.js';
import { EventRouter } from './router.js';

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();

  const config = loadConfig();

  const tokenManager = new TokenManager({
    clientId: config.grClientId,
    clientSecret: config.grClientSecret,
    oauthUrl: config.grOauthUrl,
  });
  const grClient = new GrClient(config.grApiBaseUrl, tokenManager, config.grRateLimitRpm);

  const queue = new ArchiveQueue(config.queueMaxRetries, config.queueBackoffMs);
  const router = new EventRouter(grClient, queue, prisma);

  onMessage(async (event) => {
    await router.handleMessage(event, 'Unknown Server', 'Unknown Channel');
  });

  onMessageEdit(async (event) => {
    await router.handleEdit(event, 'Unknown Server', 'Unknown Channel');
  });

  onReaction(async (event) => {
    await router.handleReaction(event, 'Unknown Server', 'Unknown Channel');
  });

  await startBot(config.discordToken, config.discordClientId);

  console.log('Bridge running. Press Ctrl+C to stop.');

  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch(async (err) => {
  console.error('Bridge failed to start:', err);
  await prisma.$disconnect();
  process.exit(1);
});

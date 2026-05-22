import { Events } from 'discord.js';
import { getClient } from './client.js';
import { handleMessageCreate } from './handlers/messageCreate.js';
import { handleMessageUpdate } from './handlers/messageUpdate.js';
import { handleMessageDelete } from './handlers/messageDelete.js';
import { handleReactionAdd } from './handlers/messageReactionAdd.js';
import { deployCommands } from './deploy-commands.js';

export type { MessageHandlerCallback } from './handlers/messageCreate.js';
export { onMessage } from './handlers/messageCreate.js';
export { onMessageEdit } from './handlers/messageUpdate.js';
export { onReaction } from './handlers/messageReactionAdd.js';
export { getClient } from './client.js';

export async function startBot(token: string, clientId: string): Promise<void> {
  const client = getClient();

  client.on(Events.MessageCreate, handleMessageCreate);
  client.on(Events.MessageUpdate, handleMessageUpdate);
  client.on(Events.MessageDelete, handleMessageDelete);
  client.on(Events.MessageReactionAdd, handleReactionAdd);

  client.once(Events.ClientReady, async (c) => {
    console.log(`Discord bot logged in as ${c.user.tag}`);
    await deployCommands(token, clientId);
  });

  await client.login(token);
}

export async function stopBot(): Promise<void> {
  const client = getClient();
  client.destroy();
}

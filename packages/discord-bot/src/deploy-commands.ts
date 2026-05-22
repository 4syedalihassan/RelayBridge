import { REST, Routes, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

const commands: RESTPostAPIApplicationCommandsJSONBody[] = [
  {
    name: 'status',
    description: 'Check if archiving is active for this channel',
  },
];

export async function deployCommands(token: string, clientId: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
}

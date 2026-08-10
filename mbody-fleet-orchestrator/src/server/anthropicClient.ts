import Anthropic from '@anthropic-ai/sdk';

let aiClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!aiClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is missing.');
    }
    aiClient = new Anthropic({
      apiKey,
      defaultHeaders: {
        'User-Agent': 'aistudio-build'
      }
    });
  }
  return aiClient;
}

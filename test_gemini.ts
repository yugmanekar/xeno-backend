import { generateAIJSON } from './src/features/ai/gemini.js';
import { segmentationPrompt } from './src/features/ai/prompts.js';

async function test() {
  const prompt = segmentationPrompt('find customers who spent a lot', 'schema here');
  console.log('PROMPT:', prompt);
  const result = await generateAIJSON(prompt);
  console.log('RESULT:', result);
}
test();

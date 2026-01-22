/**
 * Google GenAI SDK Adapter
 *
 * Converts core tool definitions to Google GenAI function declaration format.
 * Works with @google/genai SDK and models like gemini-3-flash-preview.
 *
 * Usage:
 *   import { googleGenaiTools, executeTool } from './adapters/google-genai';
 */

import { Type } from '@google/genai';
import { z } from 'zod';
import { arcTools } from '../core.js';

// Convert Zod schema to Google GenAI function declaration format
function zodToGoogleSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  return {
    type: Type.OBJECT,
    properties: jsonSchema.properties || {},
    required: jsonSchema.required || [],
  };
}

// Tool declarations for Google GenAI SDK
export const googleGenaiTools = Object.values(arcTools).map((tool) => ({
  name: tool.name,
  description: tool.description,
  parameters: zodToGoogleSchema(tool.inputSchema),
}));

// Execute a tool by name
export async function executeTool(name: string, args: Record<string, unknown>) {
  const tool = arcTools[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const parsed = tool.inputSchema.parse(args);
  return tool.execute(parsed);
}

// Re-export for convenience
export { arcTools } from '../core.js';

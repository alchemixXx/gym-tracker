import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as gym from '../services/gymData.js';

/**
 * Builds an McpServer instance wired to the gym data service for a specific
 * user. The server exposes read tools (progress analysis) and write tools
 * (create/update programs and templates). Writes are deliberately limited to
 * programs and templates — sessions, measurements, food and photos are never
 * mutated through MCP.
 */

// Reusable zod shapes for program/template structure
const setShape = z
  .object({
    weight: z
      .number()
      .nullable()
      .optional()
      .describe('Working weight in kg. Null/omitted for bodyweight exercises.'),
    reps: z.number().int().describe('Repetitions per set.'),
    count: z
      .number()
      .int()
      .optional()
      .describe('How many sets of this weight×reps (default 1).'),
  })
  .describe('One set spec, e.g. 65kg × 4 sets × 10 reps → {weight:65,count:4,reps:10}');

const exerciseShape = z.object({
  name: z.string().describe('Exercise name, e.g. "Присідання зі штангою".'),
  sets: z.array(setShape).optional(),
});

const dayShape = z.object({
  name: z.string().describe('Training day name, e.g. "День 1 — Ноги".'),
  exercises: z.array(exerciseShape).optional(),
});

const daysShape = z
  .array(dayShape)
  .describe('Full training week: days → exercises → sets.');

function text(data: unknown) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

function errorText(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

export function buildMcpServer(userId: number): McpServer {
  const server = new McpServer({
    name: 'gym-tracker',
    version: '1.0.0',
  });

  // ---------------- READ TOOLS ----------------

  server.registerTool(
    'list_programs',
    {
      title: 'List programs',
      description:
        'List all weekly training programs (metadata only, newest first). Use get_program for full structure.',
      inputSchema: {},
    },
    async () => text(await gym.listPrograms(userId)),
  );

  server.registerTool(
    'get_program',
    {
      title: 'Get program',
      description:
        'Get one program with its full structure: days → exercises → sets, including per-set done flags and notes.',
      inputSchema: { programId: z.number().int() },
    },
    async ({ programId }) => {
      const program = await gym.getProgram(userId, programId);
      if (!program) return errorText(`Program ${programId} not found.`);
      return text(program);
    },
  );

  server.registerTool(
    'get_analysis',
    {
      title: 'Get analysis data',
      description:
        'Fetch aggregated progress data: all programs with COMPLETED training days (full set detail) plus all body measurements. This is the primary input for assessing progress and deciding program adjustments.',
      inputSchema: {},
    },
    async () => text(await gym.getAnalysisData(userId)),
  );

  server.registerTool(
    'list_measurements',
    {
      title: 'List measurements',
      description:
        'List body measurements (weight + circumferences) with their entries, newest first.',
      inputSchema: {},
    },
    async () => text(await gym.listMeasurements(userId)),
  );

  server.registerTool(
    'list_templates',
    {
      title: 'List templates',
      description:
        'List reusable program templates (metadata only). Use get_template for full structure.',
      inputSchema: {},
    },
    async () => text(await gym.listTemplates(userId)),
  );

  server.registerTool(
    'get_template',
    {
      title: 'Get template',
      description: 'Get one template with its full structure: days → exercises → sets.',
      inputSchema: { templateId: z.number().int() },
    },
    async ({ templateId }) => {
      const template = await gym.getTemplate(userId, templateId);
      if (!template) return errorText(`Template ${templateId} not found.`);
      return text(template);
    },
  );

  // ---------------- WRITE TOOLS ----------------

  server.registerTool(
    'create_program',
    {
      title: 'Create program',
      description:
        'Create a new weekly program. Provide an explicit day/exercise/set structure, or pass a templateId to copy one. If a program with the same name already exists it is returned unchanged (created=false).',
      inputSchema: {
        name: z.string().describe('Program name (e.g. "Тиждень 12 — Набір маси").'),
        start_date: z
          .string()
          .nullable()
          .optional()
          .describe('ISO date (YYYY-MM-DD) when the program starts.'),
        template_id: z
          .number()
          .int()
          .nullable()
          .optional()
          .describe('Copy structure from this template id (when days omitted).'),
        days: daysShape.optional(),
      },
    },
    async ({ name, start_date, template_id, days }) => {
      if (!name.trim()) return errorText('name is required.');
      const result = await gym.createProgram(userId, {
        name,
        start_date,
        template_id,
        days,
      });
      return text(result);
    },
  );

  server.registerTool(
    'update_program',
    {
      title: 'Update program',
      description:
        'Update a program. Can change name/start_date and/or replace its day structure. Only NON-completed days are replaced — already-completed training days are preserved. Completed (read-only) programs cannot be edited.',
      inputSchema: {
        programId: z.number().int(),
        name: z.string().optional(),
        start_date: z.string().nullable().optional(),
        days: daysShape
          .optional()
          .describe('If provided, replaces all non-completed days.'),
      },
    },
    async ({ programId, name, start_date, days }) => {
      const result = await gym.updateProgram(userId, programId, {
        name,
        start_date,
        days,
      });
      if (!result.ok) {
        if (result.reason === 'not_found')
          return errorText(`Program ${programId} not found.`);
        return errorText(
          `Program ${programId} is completed (read-only) and cannot be edited.`,
        );
      }
      return text(result.program);
    },
  );

  server.registerTool(
    'create_template',
    {
      title: 'Create template',
      description:
        'Create a reusable program template with a full day/exercise/set structure.',
      inputSchema: {
        name: z.string(),
        days: daysShape.optional(),
      },
    },
    async ({ name, days }) => {
      if (!name.trim()) return errorText('name is required.');
      return text(await gym.createTemplate(userId, { name, days }));
    },
  );

  server.registerTool(
    'update_template',
    {
      title: 'Update template',
      description:
        'Update a template name and/or fully replace its day structure.',
      inputSchema: {
        templateId: z.number().int(),
        name: z.string().optional(),
        days: daysShape.optional(),
      },
    },
    async ({ templateId, name, days }) => {
      const result = await gym.updateTemplate(userId, templateId, {
        name,
        days,
      });
      if (!result.ok) return errorText(`Template ${templateId} not found.`);
      return text(result.template);
    },
  );

  return server;
}

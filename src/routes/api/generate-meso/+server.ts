import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_MESSAGES = 40;       // max turns in a single meso conversation
const MAX_MSG_CHARS = 4_000;   // max characters per user message

const SYSTEM_PROMPT = `You are an expert strength and conditioning coach specializing in hypertrophy mesocycle programming. Help users design effective 4-12 week training blocks.

Keep responses conversational and concise. After 1-2 messages of clarification (if needed), call propose_mesocycle to generate the plan. Don't over-explain — just build great programs.

EXERCISE NAMING: Use standard gym exercise names (e.g., "Barbell Squat", "Bench Press", "Lat Pulldown", "Romanian Deadlift", "Incline Dumbbell Press", "Cable Row", "Leg Press", "Tricep Pushdown", "Bicep Curls", "Lateral Raises", "Face Pulls", "Leg Curls", "Calf Raises").

PROGRAMMING RULES:
- microcycleDays = liftingDays + restDays (usually 7)
- schedule must have exactly microcycleDays entries with dayIndex 1 through microcycleDays
- workoutTypes = count of unique workout names (PPL = 3, Upper/Lower = 2, Full Body = 1 or 2)
- exercisesPerType keys must exactly match workoutName values in schedule
- Compound lifts first, isolation second. 4-6 exercises per session.
- startSets 3-4, endSets 4-6 for progressive overload across the mesocycle
- Default totalCycles = 6 unless specified. Include deload at end (reduceSets: 50, reduceWeight: 10, reduceReps: 0).`;

const PROPOSE_TOOL: Anthropic.Tool = {
    name: 'propose_mesocycle',
    description: 'Generate and propose a complete mesocycle plan. Call this once you have enough info from the user.',
    input_schema: {
        type: 'object',
        required: ['summary', 'config', 'schedule', 'exercisesPerType', 'deloadConfig'],
        properties: {
            summary: {
                type: 'string',
                description: '2-3 sentence plain-English summary of the plan (split type, duration, training philosophy).'
            },
            config: {
                type: 'object',
                required: ['mesoName', 'microcycleDays', 'liftingDays', 'restDays', 'workoutTypes', 'totalCycles'],
                properties: {
                    mesoName: { type: 'string' },
                    microcycleDays: { type: 'integer', minimum: 4, maximum: 10 },
                    liftingDays: { type: 'integer', minimum: 1, maximum: 7 },
                    restDays: { type: 'integer', minimum: 0, maximum: 6 },
                    workoutTypes: { type: 'integer', minimum: 1, maximum: 7 },
                    totalCycles: { type: 'integer', minimum: 3, maximum: 12 }
                }
            },
            schedule: {
                type: 'array',
                description: 'Exactly microcycleDays entries, dayIndex 1-N',
                items: {
                    type: 'object',
                    required: ['dayIndex', 'type'],
                    properties: {
                        dayIndex: { type: 'integer' },
                        type: { type: 'string', enum: ['rest', 'lift'] },
                        workoutName: { type: 'string' }
                    }
                }
            },
            exercisesPerType: {
                type: 'object',
                description: 'Keys are workout names matching schedule, values are exercise arrays',
                additionalProperties: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['name', 'startSets', 'endSets'],
                        properties: {
                            name: { type: 'string' },
                            startSets: { type: 'integer', minimum: 2, maximum: 6 },
                            endSets: { type: 'integer', minimum: 2, maximum: 8 },
                            isDropset: { type: 'boolean' },
                            progressionType: { type: 'string', enum: ['linear', 'manual'] },
                            manualSets: { type: 'array', items: { type: 'integer' } }
                        }
                    }
                }
            },
            deloadConfig: {
                type: 'object',
                required: ['enabled', 'duration', 'weeks'],
                properties: {
                    enabled: { type: 'boolean' },
                    duration: { type: 'integer', minimum: 1, maximum: 2 },
                    weeks: {
                        type: 'array',
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['dayIndex', 'workoutName', 'reduceSets', 'reduceWeight', 'reduceReps'],
                                properties: {
                                    dayIndex: { type: 'integer' },
                                    workoutName: { type: 'string' },
                                    reduceSets: { type: 'integer', minimum: 0, maximum: 100 },
                                    reduceWeight: { type: 'integer', minimum: 0, maximum: 50 },
                                    reduceReps: { type: 'integer', minimum: 0, maximum: 50 }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

/** Build the exercise library section of the system prompt, grouped by muscle. */
function buildLibraryPrompt(library: { name: string; muscle_group: string }[]): string {
    if (!library.length) return '';

    const byMuscle: Record<string, string[]> = {};
    for (const ex of library) {
        const group = ex.muscle_group || 'Other';
        if (!byMuscle[group]) byMuscle[group] = [];
        byMuscle[group].push(ex.name);
    }

    const lines = Object.entries(byMuscle)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, names]) => `  ${group}: ${names.join(', ')}`);

    return `\nEXERCISE LIBRARY (use ONLY exercises from this list — do not invent names):\n${lines.join('\n')}`;
}

export const POST: RequestHandler = async ({ request }) => {
    // ── Auth check ────────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse & validate body ─────────────────────────────────────────────
    const { messages, exerciseLibrary = [] } = await request.json() as {
        messages: Anthropic.MessageParam[];
        exerciseLibrary: { name: string; muscle_group: string }[];
    };

    if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
        return json({ error: 'Invalid request' }, { status: 400 });
    }
    // Trim any individual message that is suspiciously long
    const safeMessages = messages.map(m => {
        if (typeof m.content === 'string' && m.content.length > MAX_MSG_CHARS) {
            return { ...m, content: m.content.slice(0, MAX_MSG_CHARS) };
        }
        return m;
    });

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const fullSystem = SYSTEM_PROMPT + buildLibraryPrompt(exerciseLibrary);

    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: fullSystem,
            tools: [PROPOSE_TOOL],
            messages: safeMessages
        });

        const toolUseBlock = response.content.find(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );
        const textBlock = response.content.find(
            (b): b is Anthropic.TextBlock => b.type === 'text'
        );

        return json({
            content: response.content,
            stopReason: response.stop_reason,
            proposedPlan: toolUseBlock ? { id: toolUseBlock.id, ...toolUseBlock.input as object } : null,
            text: textBlock?.text ?? null
        });
    } catch (err: any) {
        console.error('Claude API error:', err);
        return json({ error: err.message ?? 'Unknown error' }, { status: 500 });
    }
};

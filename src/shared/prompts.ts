export interface Preset {
  id: string;
  label: string;
  instruction: string;
}

/** The actions that omapen ships in its prompts.json. */
export const DEFAULT_PRESETS: readonly Preset[] = [
  {
    id: 'grammar',
    label: 'Fix grammar',
    instruction:
      'Fix spelling, grammar and punctuation. Change nothing else: not the wording, not the tone, not the structure.',
  },
  {
    id: 'rewrite',
    label: 'Rewrite',
    instruction:
      'Rewrite this so it reads better. Keep the meaning, the voice and roughly the length.',
  },
  {
    id: 'shorten',
    label: 'Shorten',
    instruction:
      'Cut this down. Keep every point that carries information, drop the rest. Do not add anything.',
  },
  {
    id: 'elaborate',
    label: 'Elaborate',
    instruction:
      'Expand this with the detail a reader would ask for next. Invent no facts: only draw out what the text already implies.',
  },
  {
    id: 'formal',
    label: 'More formal',
    instruction:
      'Rewrite this in a professional register. No slang, no contractions, no stiffness either.',
  },
  {
    id: 'casual',
    label: 'More casual',
    instruction: 'Rewrite this the way you would say it to a colleague. Plain, warm, not sloppy.',
  },
  {
    id: 'bullets',
    label: 'To bullets',
    instruction:
      'Turn this into a short bulleted list, one idea per bullet, in the order the text makes them.',
  },
  {
    id: 'translate-en',
    label: 'Translate to EN',
    instruction:
      'Translate this into English. Match the register of the original. Output the translation only.',
  },
];

/** Returns the presets in `value`, or an error message when it is not a valid list. */
export function parsePresets(value: unknown): Preset[] | string {
  if (!Array.isArray(value)) return 'The actions must be a JSON array.';
  const presets: Preset[] = [];
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    const { id, label, instruction } = (item ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string' || !id.trim()) return `Action ${index + 1} has no "id".`;
    if (typeof label !== 'string' || !label.trim()) return `Action "${id}" has no "label".`;
    if (typeof instruction !== 'string' || !instruction.trim()) {
      return `Action "${id}" has no "instruction".`;
    }
    if (ids.has(id)) return `The id "${id}" is used two times.`;
    ids.add(id);
    presets.push({ id, label, instruction });
  }
  if (!presets.length) return 'Add one action or more.';
  return presets;
}

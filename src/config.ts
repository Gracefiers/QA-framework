import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ConfigSchema = z.object({
  projectType: z.enum(['web', 'api', 'mobile']).default('web'),
  publicPath: z.string().default('/'),
  checks: z
    .record(
      z.string(),
      z.object({
        enabled: z.boolean().default(true),
        required: z.boolean().default(true),
        command: z.string().optional(),
      })
    )
    .default({}),
  gate: z
    .object({
      failFast: z.boolean().default(false),
    })
    .default(() => ({ failFast: false })),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(cwd: string): Config {
  const path = join(cwd, 'qa.config.json');
  if (!existsSync(path)) throw new Error(`qa.config.json introuvable dans ${cwd}`);
  return ConfigSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}
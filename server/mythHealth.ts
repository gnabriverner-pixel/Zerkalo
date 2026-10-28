import { resolvePersonalMythWriter, PERSONAL_MYTH_WRITER_V2A_VERSION } from './mythWriterV2A';
import { PERSONAL_MYTH_WRITER_V41_VERSION } from './mythWriterV41';
import { PERSONAL_MYTH_WRITER_VERSION } from './myth';
import { WRITER_V41_MODEL, PRIMARY_MODEL, FALLBACK_MODEL } from './routerai';

/** Model/writer actually used for the Personal Myth under the current configuration (shown in /health/ready). */
export function personalMythHealthInfo(env: NodeJS.ProcessEnv = process.env, legacyModel: string = PRIMARY_MODEL) {
  const writer = resolvePersonalMythWriter(env);
  if (writer === 'v2a') return { model: WRITER_V41_MODEL, writer: PERSONAL_MYTH_WRITER_V2A_VERSION, fallback_model: PRIMARY_MODEL };
  if (writer === 'v41') return { model: WRITER_V41_MODEL, writer: PERSONAL_MYTH_WRITER_V41_VERSION, fallback_model: FALLBACK_MODEL };
  return { model: legacyModel, writer: PERSONAL_MYTH_WRITER_VERSION, fallback_model: FALLBACK_MODEL };
}

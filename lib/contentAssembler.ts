import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Крок 1 контент-асемблера (Варіант А, еволюційна міграція).
 *
 * Читає /content/manifest.json і md-файли навичок/героїв/локацій/вікових
 * адаптерів/safety, склеює їх у системний промпт для простого 2-кроквого
 * циклу генерація+верифікація, який лишається в app/api/story/route.ts.
 *
 * Це НЕ повна 8-кроква pipeline з архітектурного документа — той рівень
 * деталізації (окремі validator-кроки, story_state, acceptance checklist)
 * заплановано на наступний крок міграції, коли буде підключено БД.
 */

const CONTENT_ROOT = process.cwd();

type SkillKey = "self_regulation" | "relationships";
type CharacterKey = "explorer" | "observer";
type LocationKey = "forest" | "space" | "city" | "home";
type AgeBand = "3-5" | "6-8";

interface Manifest {
  shared: { proseCraft: string; safetyGuardrails: string; caregiverSummarySpec: string; choiceTypes: string };
  skills: Record<SkillKey, { name: string; file: string; subtopics: string[] }>;
  characters: Record<CharacterKey, { name: string; file: string; defaultName: string }>;
  locations: Record<LocationKey, { name: string; file: string; image: string }>;
  ageBands: Record<AgeBand, { name: string; file: string }>;
  caregiverSummaryFallback: Record<SkillKey, Record<AgeBand, string>>;
}

let manifestCache: Manifest | null = null;
const fileBodyCache = new Map<string, string>();
const systemPromptCache = new Map<string, string>();

export function loadManifest(): Manifest {
  if (manifestCache) return manifestCache;
  const raw = fs.readFileSync(path.join(CONTENT_ROOT, "content", "manifest.json"), "utf-8");
  manifestCache = JSON.parse(raw) as Manifest;
  return manifestCache;
}

function readMdBody(relPath: string): string {
  const cached = fileBodyCache.get(relPath);
  if (cached) return cached;
  const raw = fs.readFileSync(path.join(CONTENT_ROOT, relPath), "utf-8");
  const { content } = matter(raw);
  const body = content.trim();
  fileBodyCache.set(relPath, body);
  return body;
}

export interface StoryParams {
  skill: SkillKey;
  skillSubtopic: string;
  character: CharacterKey;
  location: LocationKey;
  ageBand: AgeBand;
}

export const VALID_SKILLS: SkillKey[] = ["self_regulation", "relationships"];
export const VALID_CHARACTERS: CharacterKey[] = ["explorer", "observer"];
export const VALID_LOCATIONS: LocationKey[] = ["forest", "space", "city", "home"];
export const VALID_AGE_BANDS: AgeBand[] = ["3-5", "6-8"];

export function isValidStoryParams(p: Partial<StoryParams>): p is StoryParams {
  return (
    !!p.skill && VALID_SKILLS.includes(p.skill as SkillKey) &&
    !!p.character && VALID_CHARACTERS.includes(p.character as CharacterKey) &&
    !!p.location && VALID_LOCATIONS.includes(p.location as LocationKey) &&
    !!p.ageBand && VALID_AGE_BANDS.includes(p.ageBand as AgeBand) &&
    typeof p.skillSubtopic === "string" && p.skillSubtopic.length > 0
  );
}

/**
 * Системний промпт для кроку генерації сцени: прозова майстерність
 * (незмінна з попереднього SYSTEM_PROMPT) + навичка + герой + локація +
 * віковий адаптер + скорочені safety-засади.
 */
export function assembleSceneSystemPrompt(params: StoryParams): string {
  const key = `scene:${params.skill}:${params.character}:${params.location}:${params.ageBand}`;
  const cached = systemPromptCache.get(key);
  if (cached) return cached;

  const manifest = loadManifest();
  const skill = manifest.skills[params.skill];
  const character = manifest.characters[params.character];
  const location = manifest.locations[params.location];
  const ageAdapter = manifest.ageBands[params.ageBand];

  const parts = [
    "Ти оповідач дитячих інтерактивних казок українською мовою.",
    readMdBody(manifest.shared.proseCraft),
    `# Навичка казки\n\n${readMdBody(skill.file)}`,
    `# Паспорт героя\n\n${readMdBody(character.file)}`,
    `# Локація\n\n${readMdBody(location.file)}`,
    `# Віковий режим\n\n${readMdBody(ageAdapter.file)}`,
    `# Типи виборів\n\n${readMdBody(manifest.shared.choiceTypes)}`,
    `# Safety-засади (обов'язкові обмеження)\n\n${readMdBody(manifest.shared.safetyGuardrails)}`,
  ];

  const prompt = parts.join("\n\n---\n\n");
  systemPromptCache.set(key, prompt);
  return prompt;
}

/** Системний промпт для фінальної сцени + caregiver_summary. */
export function assembleFinalSystemPrompt(params: StoryParams): string {
  const key = `final:${params.skill}:${params.character}:${params.ageBand}`;
  const cached = systemPromptCache.get(key);
  if (cached) return cached;

  const manifest = loadManifest();
  const skill = manifest.skills[params.skill];
  const character = manifest.characters[params.character];
  const ageAdapter = manifest.ageBands[params.ageBand];

  const parts = [
    "Ти оповідач дитячих інтерактивних казок українською мовою.",
    readMdBody(manifest.shared.proseCraft),
    `# Навичка казки\n\n${readMdBody(skill.file)}`,
    `# Паспорт героя\n\n${readMdBody(character.file)}`,
    `# Віковий режим\n\n${readMdBody(ageAdapter.file)}`,
    `# Специфікація резюме для батьків (caregiver_summary)\n\n${readMdBody(manifest.shared.caregiverSummarySpec)}`,
  ];

  const prompt = parts.join("\n\n---\n\n");
  systemPromptCache.set(key, prompt);
  return prompt;
}

export function getSkillName(skill: SkillKey): string {
  return loadManifest().skills[skill].name;
}

export function getCharacterInfo(character: CharacterKey) {
  return loadManifest().characters[character];
}

export function getLocationInfo(location: LocationKey) {
  return loadManifest().locations[location];
}

export function loadFallbackCaregiverSummary(skill: SkillKey, ageBand: AgeBand): Record<string, unknown> {
  const manifest = loadManifest();
  const relPath = manifest.caregiverSummaryFallback[skill][ageBand];
  const raw = fs.readFileSync(path.join(CONTENT_ROOT, relPath), "utf-8");
  return JSON.parse(raw);
}

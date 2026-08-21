import Anthropic from "@anthropic-ai/sdk";
import {
  assembleFinalSystemPrompt,
  assembleSceneSystemPrompt,
  getCharacterInfo,
  getSkillName,
  isValidStoryParams,
  loadFallbackCaregiverSummary,
  type StoryParams,
} from "@/lib/contentAssembler";
import { getServiceSupabase, isSupabaseConfigured } from "@/lib/db/client";
import { getSceneStep, getStoryStructure, type AgeBand, type ChoiceType } from "@/lib/storyStructure";

const client = new Anthropic();

const CHOICE_TYPE_GUIDANCE: Record<ChoiceType, string> = {
  "пригодницький": `ПРИГОДНИЦЬКИЙ ВИБІР
Чистий вибір пригоди. Обидва варіанти нейтральні — просто різні напрямки.
Мета: дитина відчуває що керує історією. Не визначає морально правильну поведінку.`,
  "тематично-контрастний": `ТЕМАТИЧНО-КОНТРАСТНИЙ ВИБІР
Два варіанти контрастно відображають типовий неефективний спосіб дії проти альтернативної
стратегії з навички вище (див. "Заборонені формулювання варіантів вибору" в навичці — це НЕ
очевидне добре/погане, обидва варіанти психологічно правдоподібні).
Дитина моделює реальну ситуацію через безпечний простір казки.`,
  "інтеграційний": `ІНТЕГРАЦІЙНИЙ ВИБІР
Перевіряє перенесення навички в нову ситуацію, відмінну від попередньої. Обидва варіанти —
різні конкретні способи застосувати те, чого герой уже вчився в цій казці (напр. назвати що
відчуває й запропонувати рішення / зробити паузу / запропонувати два варіанти домовленості).
Не повторює дослівно попередній вибір цієї казки.`,
};

// ═══════════════════════════════════════
// USER ПРОМПТ — генерація сцени з вибором
// ═══════════════════════════════════════
function buildScenePrompt({
  skillSubtopic,
  characterName,
  scene,
  totalScenes,
  choiceType,
  historyText,
  usedMaybePhrase,
  usedEtiquette,
}: {
  skillSubtopic: string;
  characterName: string;
  scene: number;
  totalScenes: number;
  choiceType: ChoiceType;
  historyText: string;
  usedMaybePhrase: boolean;
  usedEtiquette: boolean;
}) {
  return `Поведінкова підтема цієї казки: ${skillSubtopic} (див. розділ "Підтеми, валідовані для MVP" у навичці вище).
Це сцена ${scene} з ${totalScenes}.

Імʼя героя НЕ ЗМІНЮЄТЬСЯ протягом всієї казки — завжди ${characterName}.

КОНТЕКСТ ПОПЕРЕДНІХ СЦЕН:
${historyText}

Нова сцена продовжує попередню органічно:
— Персонажі які зʼявились раніше залишаються якщо не пішли
— Місце дії змінюється тільки якщо це випливає з попереднього вибору
— Настрій і тон продовжують попередню сцену
— НЕ переказуй і не повторюй події, вже описані в контексті вище — дитина вже їх прочитала.
  Почни з нового моменту, що настає ПІСЛЯ того, чим закінчився контекст.

${usedMaybePhrase ? '— Майже-фраза вже була використана раніше — в цій сцені її НЕ МАЄ БУТИ.' : ''}
${usedEtiquette ? '— Момент етикету вже був — в цій сцені не потрібен.' : ''}

ВИБІР ДЛЯ ДИТИНИ

Тип вибору для ЦІЄЇ сцени заданий наперед (не обирай сам): **${choiceType}**.

${CHOICE_TYPE_GUIDANCE[choiceType]}

ПРАВИЛА:
— Формулювання від імені героя: не "що зробити ${characterName}?" а "${characterName} подивився вперед... і назад... Куди йти?"
— Обидва варіанти однаково привабливі
— Дотримуйся обмежень вікового режиму (к-сть персонажів/мова) з розділу вище

НАСЛІДКИ ВИБОРУ

Обидва варіанти мають вести до відчутно різного продовження історії далі — інша реакція
персонажа, інша ситуація, інший емоційний тон зустрічі. Не однаковий наступний крок з різними
словами. Якщо байдуже яку з двох дитина обере — вибір декоративний і підриває довіру дитини
до власних рішень.

Відповідай ТІЛЬКИ JSON без markdown і без пояснень:
{"scene_text":"...","choice_a":"...","choice_b":"...","used_maybe_phrase":true/false,"used_etiquette":true/false}`;
}

// ═══════════════════════════════════════
// USER ПРОМПТ — перехідна сцена (без вибору)
// ═══════════════════════════════════════
function buildTransitionPrompt({
  skillSubtopic,
  characterName,
  scene,
  totalScenes,
  historyText,
  usedMaybePhrase,
  usedEtiquette,
}: {
  skillSubtopic: string;
  characterName: string;
  scene: number;
  totalScenes: number;
  historyText: string;
  usedMaybePhrase: boolean;
  usedEtiquette: boolean;
}) {
  return `Поведінкова підтема цієї казки: ${skillSubtopic}.
Це сцена ${scene} з ${totalScenes} — ПЕРЕХІДНА, без вибору для дитини.

Імʼя героя НЕ ЗМІНЮЄТЬСЯ протягом всієї казки — завжди ${characterName}.

КОНТЕКСТ ПОПЕРЕДНІХ СЦЕН:
${historyText}

Напиши коротку сцену (2-4 речення), яка природно продовжує наслідок попереднього вибору
дитини й веде до наступної точки вибору. Це не самостійна пригода — місток між двома
виборами: показує безпосередній результат попереднього рішення (через дію/діалог/деталь,
не пояснення) і відкриває наступну ситуацію.

Наслідок має бути конкретним і видимим — не узагальненим "пішли далі". Якщо ця сцена читалась
би однаково незалежно від того, який варіант дитина обрала раніше — перепиши так, щоб було
видно саме той вибір: інша реакція персонажа, інша деталь ситуації, інший тон.

НЕ переказуй і не повторюй події, вже описані в контексті вище — дитина вже їх прочитала.
Почни з нового моменту, що настає ПІСЛЯ того, чим закінчився контекст.

${usedMaybePhrase ? '— Майже-фраза вже була використана раніше — в цій сцені її НЕ МАЄ БУТИ.' : ''}
${usedEtiquette ? '— Момент етикету вже був — в цій сцені не потрібен.' : ''}

Відповідай ТІЛЬКИ JSON без markdown і без пояснень:
{"scene_text":"...","used_maybe_phrase":true/false,"used_etiquette":true/false}`;
}

// ═══════════════════════════════════════
// ПРОМПТ ВЕРИФІКАЦІЇ — сцена з вибором
// ═══════════════════════════════════════
function buildVerificationPrompt({
  scene_text,
  choice_a,
  choice_b,
  choice_type,
  skillSubtopic,
  historyText,
}: {
  scene_text: string;
  choice_a: string;
  choice_b: string;
  choice_type: ChoiceType;
  skillSubtopic: string;
  historyText: string;
}) {
  return `Перевір цю сцену дитячої казки. Відповідай тільки JSON.

СЦЕНА:
${scene_text}

ВАРІАНТ А: ${choice_a}
ВАРІАНТ Б: ${choice_b}
ТИП ВИБОРУ: ${choice_type}
ПОВЕДІНКОВА ПІДТЕМА: ${skillSubtopic}
КОНТЕКСТ: ${historyText}

АБСОЛЮТНІ ЗАБОРОНИ — кожна з них одразу дає пройшла:false:

1. немає_авторських_коментарів — відсутні: "відчув як...", "йому хотілося", "стало тепло", "серце стиснулося", "сльози самі покотилися", будь-який опис внутрішнього стану героя від автора. (true/false)

2. немає_шаблонних_дій — відсутні: дивитись вниз потім на небо, крок вперед-назад, та інші дії які не розкривають характер саме цього персонажа. (true/false)

3. немає_прямої_моралі — мораль не озвучується прямо, немає "справжній друг / справжня дружба" як фінального висновку, немає повчального резюме. (true/false)

4. немає_незрозумілих_метафор — відсутні поетичні образи які треба пояснювати дитині відповідного віку. (true/false)

5. вибір_збалансований — обидва варіанти однаково привабливі, жоден не виглядає як очевидно правильний або очевидно поганий, жоден не порушує щойно встановлене правило так, що виглядає "тестом слухняності" (див. safety-засади: заборонено очевидне добре/погане, безпечне проти небезпечного, "ти помилився"). (true/false)

6. тип_вибору_коректний — звір з вимогами типу "${choice_type}" з розділу "Типи виборів" вище: для тематично-контрастного — контраст неефективного способу дії й альтернативної стратегії з навички; для інтеграційного — перенесення навички в нову ситуацію, не дослівний повтор попереднього вибору цієї казки; для пригодницького — нейтральний вибір напрямку, без моральної оцінки. (true/false)

7. safety_якорі_дотримані — не порушено жодне з правил BLOCK у safety-засадах вище (три якорі безпеки, межа емоційної інтенсивності, відповідальність дитини, природні наслідки). (true/false)

8. фізична_логіка_і_тіло_героя_коректні — головний герой-дитина описаний з людським тілом (руки/ноги/пальці) — НІКОЛИ "лапи"/"крила"/"хвіст"/"дзьоб" про нього/неї; усі дії й образи фізично можливі й дитина 5-8 років може уявити їх як конкретну картинку (напр. персонаж без рук не тримає предметів що потребують хвату; фізичний стан предмета — температура, вологість тощо — не змінюється миттєво без причини в тексті). (true/false)

9. не_дублює_контекст — сцена НЕ переказує і не повторює текстово події, вже описані в КОНТЕКСТІ вище (може коротко на них посилатись, але не переписувати заново той самий момент). (true/false)

СИТУАТИВНА ПЕРЕВІРКА — не є причиною відхилення, але фіксуй:

10. є_діалог — є хоча б один обмін репліками між персонажами. (true/false)
11. є_центральний_момент — сцена будується навколо одного конкретного моменту а не переліку подій. (true/false)
12. майже_фраза_не_повторюється — якщо usedMaybePhrase=true і в цій сцені є майже-фраза — це false. Якщо usedMaybePhrase=false — автоматично true. (true/false)
13. етикет_не_повторюється — якщо usedEtiquette=true і в цій сцені є момент етикету — це false. Якщо usedEtiquette=false — автоматично true. (true/false)

ПРАВИЛО ВІДХИЛЕННЯ: пройшла:false ТІЛЬКИ якщо хоча б один з пунктів 1-9 є false.
Пункти 10-13 не впливають на пройшла — але фіксуються для логів.

Відповідай ТІЛЬКИ JSON:
{"немає_авторських_коментарів":true/false,"немає_шаблонних_дій":true/false,"немає_прямої_моралі":true/false,"немає_незрозумілих_метафор":true/false,"вибір_збалансований":true/false,"тип_вибору_коректний":true/false,"safety_якорі_дотримані":true/false,"фізична_логіка_і_тіло_героя_коректні":true/false,"не_дублює_контекст":true/false,"є_діалог":true/false,"є_центральний_момент":true/false,"майже_фраза_не_повторюється":true/false,"етикет_не_повторюється":true/false,"пройшла":true/false,"причина_відмови":"..."/null}`;
}

// ═══════════════════════════════════════
// ПРОМПТ ВЕРИФІКАЦІЇ — перехідна сцена (без вибору, коротша перевірка)
// ═══════════════════════════════════════
function buildTransitionVerificationPrompt({
  scene_text,
  historyText,
}: {
  scene_text: string;
  historyText: string;
}) {
  return `Перевір цю коротку перехідну сцену дитячої казки (без вибору для дитини). Відповідай тільки JSON.

СЦЕНА:
${scene_text}

КОНТЕКСТ: ${historyText}

1. немає_авторських_коментарів — відсутні описи внутрішнього стану героя від автора ("відчув", "стало тепло"). (true/false)
2. немає_прямої_моралі — без повчального висновку. (true/false)
3. логічно_продовжує_контекст — сцена є прямим і зрозумілим наслідком попереднього вибору, не суперечить контексту. (true/false)
4. safety_якорі_дотримані — не порушено правил BLOCK із safety-засад. (true/false)
5. фізична_логіка_і_тіло_героя_коректні — головний герой-дитина описаний з людським тілом (руки/ноги/пальці) — НІКОЛИ "лапи"/"крила"/"хвіст"/"дзьоб" про нього/неї; усі дії й образи фізично можливі. (true/false)
6. не_дублює_контекст — сцена НЕ переказує і не повторює текстово події, вже описані в КОНТЕКСТІ вище — починається з нового моменту. (true/false)

пройшла:false ТІЛЬКИ якщо хоча б один з пунктів 1-6 є false.

Відповідай ТІЛЬКИ JSON:
{"немає_авторських_коментарів":true/false,"немає_прямої_моралі":true/false,"логічно_продовжує_контекст":true/false,"safety_якорі_дотримані":true/false,"фізична_логіка_і_тіло_героя_коректні":true/false,"не_дублює_контекст":true/false,"пройшла":true/false,"причина_відмови":"..."/null}`;
}

// ═══════════════════════════════════════
// ПРОМПТ ФІНАЛУ
// ═══════════════════════════════════════
function buildFinalPrompt({
  characterName,
  skillSubtopic,
  ageBand,
  historyText,
}: {
  characterName: string;
  skillSubtopic: string;
  ageBand: string;
  historyText: string;
}) {
  return `Це фінальна сцена казки. Ось повний шлях який пройшла дитина:
${historyText}

ПРАВИЛА ДЛЯ ФІНАЛУ (4-5 речень):
— Покажи конкретний результат саме тих виборів через образ і подію — не через пояснення
— ${characterName} має отримати емоційну крапку: радість, тепло, або легкий смуток з надією
— Казка має відчуватись завершеною — приходить до берега, не обривається
— ${characterName} — дитина (людина): руки, ноги, пальці, НЕ "лапи"/"крила"/"хвіст"
— Фізичні стани предметів (температура, вологість тощо) не змінюються миттєво без причини в тексті
— Мораль не озвучується — вона живе в останньому образі або репліці
— Фінал не може закінчуватись тим що всі просто "усміхнулись і пішли" — потрібна конкретна деталь або репліка яка ставить крапку
— Ніяких авторських коментарів про внутрішній стан — тільки дія і діалог
— Герой має продемонструвати observable_skill_demonstration з розділу навички вище (не обов'язково ідеально)

САММАРІ ДЛЯ БАТЬКІВ (caregiver_summary) — заповни за специфікацією вище:
— skill_name, skill_in_plain_language, why_it_matters, try_today, caregiver_phrase — обов'язкові
— optional_extra_idea — тільки якщо справді дає нову ідею понад try_today, інакше null
— childhood_memory_prompt — м'яке запрошення батькам згадати власну історію з дитинства на цю тему (до 20 слів, НЕ завдання дитині — див. заборонені формулювання в специфікації), або null якщо не вдається сформулювати природно
— age_band: "${ageBand}"
— source_skill_subtopic: "${skillSubtopic}"

Додатково (понад специфікацію фреймворку, збережено з попередньої версії — цінна самостійна знахідка):
alternative: одне речення — не "що могло статись інакше в сюжеті", а який інший поведінковий патерн це розкрило б.
Формулювання: "Інший шлях показав би як..." або "Якби дитина обрала інакше — історія розкрила б..."
Приклад: "Інший шлях показав би як ініціатива і спільне створення народжують дружбу інакше — не через прийняття, а через дію разом."

parent_prompt: одне відкрите питання.
— Про реальний досвід дитини, не про героя
— Таке що батько може поставити природно, без відчуття що це "виховний момент"
Приклад: "А тобі коли-небудь хотілося щоб хтось побачив те що ти зробив — але ти боявся показати?"

Відповідай ТІЛЬКИ JSON без markdown і без пояснень:
{"ending":"...","caregiver_summary":{"skill_name":"...","skill_in_plain_language":"...","why_it_matters":"...","try_today":"...","caregiver_phrase":"...","optional_extra_idea":"..."|null,"childhood_memory_prompt":"..."|null},"alternative":"...","parent_prompt":"..."}`;
}

// ═══════════════════════════════════════
// ДОПОМІЖНА ФУНКЦІЯ — виклик Claude
// ═══════════════════════════════════════
async function callClaude({
  system,
  prompt,
  maxTokens = 2048,
}: {
  system?: string;
  prompt: string;
  maxTokens?: number;
}) {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (system) params.system = system;

  const message = await client.messages.create(params);
  const block = message.content[0];
  const text = block.type === "text" ? block.text : "";

  const clean = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("Не знайдено JSON у відповіді:", clean);
    throw new Error("Модель повернула невалідну відповідь");
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    console.error("JSON parse error:", jsonMatch[0]);
    throw new Error("Модель повернула невалідний JSON");
  }
}

interface SceneContext {
  scene: number;
  scene_text: string;
  choice_made: string;
  scene_kind?: "choice" | "transition" | "final";
  choice_type?: ChoiceType;
  chosen_option?: "A" | "B";
  chosen_choice_text?: string;
  unchosen_choice_text?: string;
  used_maybe_phrase?: boolean;
  used_etiquette?: boolean;
}

// ═══════════════════════════════════════
// PERSISTENCE — записується ОДНИМ разом при генерації фінальної сцени
// (див. коментар у lib/db/schema.sql чому не пер-сцена). Best-effort:
// якщо Supabase не налаштований або запис впав — казка все одно
// повертається дитині, помилка лише логується.
// ═══════════════════════════════════════
async function persistCompletedStory({
  params,
  characterName,
  totalScenes,
  sceneContextHistory,
  ending,
  caregiverSummary,
  alternative,
  parentPrompt,
  usedFallback,
}: {
  params: StoryParams;
  characterName: string;
  totalScenes: number;
  sceneContextHistory: SceneContext[];
  ending: string;
  caregiverSummary: Record<string, unknown> | undefined;
  alternative: string | undefined;
  parentPrompt: string | undefined;
  usedFallback: boolean;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = getServiceSupabase();

    const { data: story, error: storyError } = await supabase
      .from("stories")
      .insert({
        skill: params.skill,
        skill_subtopic: params.skillSubtopic,
        character: params.character,
        character_name: characterName,
        location: params.location,
        age_band: params.ageBand,
        total_scenes: totalScenes,
        status: "completed",
      })
      .select("story_id")
      .single();

    if (storyError || !story) {
      console.warn("Persist: не вдалося створити story:", storyError?.message);
      return null;
    }

    const storyId = story.story_id as string;

    const sceneRows = sceneContextHistory.map((s) => {
      const [label, ...rest] = s.choice_made.split(": ");
      const chosenText = s.chosen_choice_text ?? rest.join(": ");
      const isTransition = s.scene_kind === "transition";
      return {
        story_id: storyId,
        scene_number: s.scene,
        is_final: false,
        scene_kind: s.scene_kind ?? "choice",
        scene_text: s.scene_text,
        choice_type: s.choice_type ?? null,
        chosen_option: isTransition ? null : s.chosen_option ?? (label === "A" || label === "B" ? label : null),
        chosen_choice_text: isTransition ? null : chosenText || null,
        unchosen_choice_text: isTransition ? null : s.unchosen_choice_text ?? null,
        used_maybe_phrase: s.used_maybe_phrase ?? false,
        used_etiquette: s.used_etiquette ?? false,
      };
    });

    sceneRows.push({
      story_id: storyId,
      scene_number: totalScenes,
      is_final: true,
      scene_kind: "final",
      scene_text: ending,
      choice_type: null,
      chosen_option: null,
      chosen_choice_text: null,
      unchosen_choice_text: null,
      used_maybe_phrase: false,
      used_etiquette: false,
    });

    const { error: scenesError } = await supabase.from("scenes").insert(sceneRows);
    if (scenesError) console.warn("Persist: не вдалося записати scenes:", scenesError.message);

    if (caregiverSummary) {
      const { error: summaryError } = await supabase.from("caregiver_summaries").insert({
        story_id: storyId,
        skill_name: caregiverSummary.skill_name ?? null,
        skill_in_plain_language: caregiverSummary.skill_in_plain_language ?? null,
        why_it_matters: caregiverSummary.why_it_matters ?? null,
        try_today: caregiverSummary.try_today ?? null,
        caregiver_phrase: caregiverSummary.caregiver_phrase ?? null,
        optional_extra_idea: caregiverSummary.optional_extra_idea ?? null,
        childhood_memory_prompt: caregiverSummary.childhood_memory_prompt ?? null,
        alternative: alternative ?? null,
        parent_prompt: parentPrompt ?? null,
      });
      if (summaryError) console.warn("Persist: не вдалося записати caregiver_summary:", summaryError.message);
    }

    if (usedFallback) {
      console.warn(`Persist: story ${storyId} завершилась з fallback caregiver_summary.`);
    }

    return storyId;
  } catch (err) {
    console.warn("Persist: неочікувана помилка:", (err as Error).message);
    return null;
  }
}

// ═══════════════════════════════════════
// ОСНОВНИЙ HANDLER
// ═══════════════════════════════════════
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      skill,
      skillSubtopic,
      character,
      location,
      ageBand,
      characterName: characterNameInput,
      sceneContextHistory = [],
      scene = 1,
    } = body as Partial<StoryParams> & {
      characterName?: string;
      sceneContextHistory?: SceneContext[];
      scene?: number;
    };

    if (!isValidStoryParams({ skill, skillSubtopic, character, location, ageBand })) {
      return Response.json(
        { error: "Некоректні параметри казки (skill/skillSubtopic/character/location/ageBand)." },
        { status: 400 },
      );
    }

    const params = { skill, skillSubtopic, character, location, ageBand } as StoryParams;
    const characterInfo = getCharacterInfo(params.character);
    const characterName = characterNameInput?.trim() || characterInfo.defaultName;

    // Крок 3: кількість сцен і послідовність choice/transition більше не
    // приходять від клієнта — визначаються детерміновано з віку (lib/storyStructure.ts),
    // щоб точно відповідати content/age-adapters/*.md (там "Обсяг" і "Вибори" — різні числа).
    const structure = getStoryStructure(params.ageBand as AgeBand);
    const totalScenes = structure.totalScenes;
    const isFinalScene = Number(scene) >= totalScenes;
    const sceneStep = isFinalScene ? null : getSceneStep(params.ageBand as AgeBand, Number(scene));

    const historyText =
      sceneContextHistory.length > 0
        ? sceneContextHistory
            .map((s) => {
              const tail =
                s.scene_kind === "transition"
                  ? "→ (без вибору — сюжет просто продовжився)"
                  : `→ Вибір дитини: ${s.choice_made}`;
              return `Сцена ${s.scene}:\n${s.scene_text}\n${tail}`;
            })
            .join("\n\n---\n\n")
        : "початок казки";

    const usedMaybePhrase = sceneContextHistory.some((s) => s.used_maybe_phrase);
    const usedEtiquette = sceneContextHistory.some((s) => s.used_etiquette);

    // ФІНАЛЬНА СЦЕНА
    if (isFinalScene) {
      let data = await callClaude({
        system: assembleFinalSystemPrompt(params),
        prompt: buildFinalPrompt({
          characterName,
          skillSubtopic: params.skillSubtopic,
          ageBand: params.ageBand,
          historyText,
        }),
        maxTokens: 2048,
      });

      let usedFallback = false;
      if (!data.caregiver_summary) {
        usedFallback = true;
        data = { ...data, caregiver_summary: loadFallbackCaregiverSummary(params.skill, params.ageBand) };
      }

      const storyId = await persistCompletedStory({
        params,
        characterName,
        totalScenes,
        sceneContextHistory,
        ending: data.ending,
        caregiverSummary: data.caregiver_summary,
        alternative: data.alternative,
        parentPrompt: data.parent_prompt,
        usedFallback,
      });

      return Response.json({
        ...data,
        skill_name: getSkillName(params.skill),
        story_id: storyId,
        total_scenes: totalScenes,
      });
    }

    // ЗВИЧАЙНА СЦЕНА — генерація + верифікація (максимум 2 спроби)
    const MAX_ATTEMPTS = 2;
    const sceneSystemPrompt = assembleSceneSystemPrompt(params);
    const isTransition = sceneStep?.kind === "transition";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const sceneData = isTransition
        ? await callClaude({
            system: sceneSystemPrompt,
            prompt: buildTransitionPrompt({
              skillSubtopic: params.skillSubtopic,
              characterName,
              scene: Number(scene),
              totalScenes,
              historyText,
              usedMaybePhrase,
              usedEtiquette,
            }),
            maxTokens: 1024,
          })
        : await callClaude({
            system: sceneSystemPrompt,
            prompt: buildScenePrompt({
              skillSubtopic: params.skillSubtopic,
              characterName,
              scene: Number(scene),
              totalScenes,
              choiceType: sceneStep!.choiceType!,
              historyText,
              usedMaybePhrase,
              usedEtiquette,
            }),
            maxTokens: 2048,
          });

      if (!isTransition) sceneData.choice_type = sceneStep!.choiceType;
      sceneData.scene_kind = isTransition ? "transition" : "choice";
      sceneData.total_scenes = totalScenes;

      let verification;
      try {
        verification = isTransition
          ? await callClaude({
              prompt: buildTransitionVerificationPrompt({
                scene_text: sceneData.scene_text,
                historyText,
              }),
              maxTokens: 256,
            })
          : await callClaude({
              prompt: buildVerificationPrompt({
                scene_text: sceneData.scene_text,
                choice_a: sceneData.choice_a,
                choice_b: sceneData.choice_b,
                choice_type: sceneData.choice_type,
                skillSubtopic: params.skillSubtopic,
                historyText,
              }),
              maxTokens: 512,
            });
      } catch (verifyError) {
        console.warn("Верифікація крашнулась:", (verifyError as Error).message);
        return Response.json(sceneData);
      }

      if (verification.пройшла) {
        return Response.json(sceneData);
      }

      if (attempt === MAX_ATTEMPTS) {
        console.warn("Верифікація не пройшла після", MAX_ATTEMPTS, "спроб:", verification.причина_відмови);
        return Response.json(sceneData);
      }

      console.log(`Спроба ${attempt} не пройшла: ${verification.причина_відмови}. Повторна генерація...`);
    }
  } catch (error) {
    console.error("Критична помилка в /api/story:", (error as Error).message);
    // Фолбек: якщо є достатньо параметрів, повертаємо заготовлене резюме замість повного 500,
    // щоб дитина принаймні побачила коректний фінал, а не помилку. Для сцен (не фіналу) fallback
    // caregiver_summary не застосовний — просто повертаємо помилку.
    return Response.json({ error: "Не вдалося згенерувати сцену. Спробуйте ще раз." }, { status: 500 });
  }
}

// Fallback caregiver_summary лишається доступним для викликів з інших місць
// (напр. якщо в майбутньому кроці Final QA буде відхиляти caregiver_summary).
export { loadFallbackCaregiverSummary };

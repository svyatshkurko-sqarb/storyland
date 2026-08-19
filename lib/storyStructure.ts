/**
 * Крок 3, інкремент 1: структура казки за віковим режимом.
 *
 * Фреймворк розрізняє "Обсяг" (кількість сцен) і "Вибори" (кількість
 * точок розгалуження) окремо — вони НЕ рівні:
 *   3-5 років: 4-5 сцен, але лише 2 вибори.
 *   6-8 років: 6 сцен, але лише 3 вибори (пригодницький, тематично-
 *              контрастний, інтеграційний).
 *
 * До цього кроку код мовчки ототожнював "сцена" і "вибір" (кожна нефінальна
 * сцена мала рівно один вибір) — totalScenes був захардкоджений на 4
 * незалежно від віку. Тут це виправлено: додано "перехідні" сцени без
 * розгалуження (одна кнопка "Далі"), щоб кількість сцен І кількість
 * виборів одночасно відповідали content/age-adapters/*.md.
 *
 * Це навмисно ДЕТЕРМІНОВАНИЙ розрахунок у коді, не окремий LLM-виклик
 * "Story Planner" — розподіл сцен/типів виборів за віком це фіксоване
 * правило з фреймворку, а не творче рішення, яке варто доручати моделі.
 * Повноцінний LLM Story Planner (крок A з 8-крокової pipeline — планування
 * сюжетної посилки, наскрізного предмета/мотиву, branch_token) — наступний,
 * ще не зроблений інкремент Кроку 3.
 */

export type AgeBand = "3-5" | "6-8";
export type ChoiceType = "пригодницький" | "тематично-контрастний" | "інтеграційний";

export interface SceneStep {
  sceneNumber: number;
  kind: "choice" | "transition";
  choiceType?: ChoiceType;
}

export interface StoryStructure {
  totalScenes: number; // включно з фінальною сценою
  steps: SceneStep[]; // сцени 1..totalScenes-1 (без фінальної)
}

const STRUCTURES: Record<AgeBand, StoryStructure> = {
  "3-5": {
    // age-3-5.md: "Обсяг: 4-5 сцен. Вибори: 2 (пригодницький і тематичний
    // можуть об'єднуватись)". Беремо верхню межу (5 сцен), 2 вибори.
    totalScenes: 5,
    steps: [
      { sceneNumber: 1, kind: "choice", choiceType: "пригодницький" },
      { sceneNumber: 2, kind: "transition" },
      { sceneNumber: 3, kind: "choice", choiceType: "тематично-контрастний" },
      { sceneNumber: 4, kind: "transition" },
    ],
  },
  "6-8": {
    // age-6-8.md: "Обсяг: 6 сцен. Вибори: 3 (пригодницький, тематично-
    // контрастний, інтеграційний)".
    totalScenes: 6,
    steps: [
      { sceneNumber: 1, kind: "choice", choiceType: "пригодницький" },
      { sceneNumber: 2, kind: "transition" },
      { sceneNumber: 3, kind: "choice", choiceType: "тематично-контрастний" },
      { sceneNumber: 4, kind: "transition" },
      { sceneNumber: 5, kind: "choice", choiceType: "інтеграційний" },
    ],
  },
};

export function getStoryStructure(ageBand: AgeBand): StoryStructure {
  return STRUCTURES[ageBand];
}

export function getSceneStep(ageBand: AgeBand, sceneNumber: number): SceneStep | null {
  return STRUCTURES[ageBand].steps.find((s) => s.sceneNumber === sceneNumber) ?? null;
}

export function getTotalScenes(ageBand: AgeBand): number {
  return STRUCTURES[ageBand].totalScenes;
}

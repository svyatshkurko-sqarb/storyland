"use client";

import { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const totalScenes = 4;

const locationImages: Record<string, string> = {
  forest: "/locations/forest.svg",
  space: "/locations/stars.svg",
  city: "/locations/town.svg",
  home: "/locations/castle.svg",
};

const locationLabels: Record<string, string> = {
  forest: "ліс",
  space: "космос",
  city: "місто",
  home: "дім",
};

const skillLabels: Record<string, string> = {
  self_regulation: "саморегуляція",
  relationships: "стосунки та взаємодія",
};

const defaultCharacterNames: Record<string, string> = {
  explorer: "Іскра",
  observer: "Зоря",
};

interface SceneContext {
  scene: number;
  scene_text: string;
  choice_made: string;
  used_maybe_phrase?: boolean;
  used_etiquette?: boolean;
}

interface CaregiverSummary {
  skill_name: string;
  skill_in_plain_language: string;
  why_it_matters: string;
  try_today: string;
  caregiver_phrase: string;
  optional_extra_idea: string | null;
  childhood_memory_prompt: string | null;
}

interface StoryParams {
  skill: string;
  skillSubtopic: string;
  character: string;
  characterName: string;
  location: string;
  ageBand: string;
  sceneContextHistory: SceneContext[];
  scene: number;
  totalScenes: number;
}

async function fetchScene(params: StoryParams) {
  const response = await fetch("/api/story", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) throw new Error("Не вдалося завантажити сцену.");
  return response.json();
}

function StoryPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const skill = searchParams.get("skill") || "";
  const skillSubtopic = searchParams.get("skillSubtopic") || "";
  const character = searchParams.get("character") || "";
  const characterNameParam = searchParams.get("characterName") || "";
  const location = searchParams.get("location") || "";
  const ageBand = searchParams.get("ageBand") || "";
  const characterName = characterNameParam || defaultCharacterNames[character] || "Друг";
  const locationImage = locationImages[location] ?? "/locations/forest.svg";

  const [scene, setScene] = useState<number>(1);
  const [sceneContextHistory, setSceneContextHistory] = useState<SceneContext[]>([]);
  const [sceneData, setSceneData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCaregiverSummary, setShowCaregiverSummary] = useState(false);

  // Pre-generated наступні сцени: ключ = "A" або "B"
  const pregenRef = useRef<Record<string, Promise<any>>>({});

  const hasParams = Boolean(skill && skillSubtopic && character && location && ageBand);
  const progressDots = useMemo(() => Array.from({ length: totalScenes }, (_, idx) => idx + 1), []);

  function baseParams(nextHistory: SceneContext[], nextScene: number): StoryParams {
    return {
      skill,
      skillSubtopic,
      character,
      characterName,
      location,
      ageBand,
      sceneContextHistory: nextHistory,
      scene: nextScene,
      totalScenes,
    };
  }

  useEffect(() => {
    if (!hasParams) return;
    setScene(1);
    setSceneContextHistory([]);
    setSceneData(null);
    setError("");
    setShowCaregiverSummary(false);
    pregenRef.current = {};
    loadScene(1, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill, skillSubtopic, character, location, ageBand]);

  // Pre-generate наступну сцену поки дитина читає поточну
  useEffect(() => {
    if (!sceneData || sceneData.ending) return;

    const nextSceneNum = scene + 1;

    // Не pre-generate якщо наступна — остання (фінал генерується після вибору)
    if (nextSceneNum >= totalScenes) return;

    pregenRef.current["A"] = fetchScene(
      baseParams(
        [
          ...sceneContextHistory,
          {
            scene,
            scene_text: sceneData.scene_text,
            choice_made: `A: ${sceneData.choice_a}`,
            used_maybe_phrase: sceneData.used_maybe_phrase,
            used_etiquette: sceneData.used_etiquette,
          },
        ],
        nextSceneNum,
      ),
    );

    pregenRef.current["B"] = fetchScene(
      baseParams(
        [
          ...sceneContextHistory,
          {
            scene,
            scene_text: sceneData.scene_text,
            choice_made: `B: ${sceneData.choice_b}`,
            used_maybe_phrase: sceneData.used_maybe_phrase,
            used_etiquette: sceneData.used_etiquette,
          },
        ],
        nextSceneNum,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneData]);

  async function loadScene(nextScene: number, nextHistory: SceneContext[]) {
    setLoading(true);
    setError("");
    try {
      const data = await fetchScene(baseParams(nextHistory, nextScene));
      setSceneData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка.");
    } finally {
      setLoading(false);
    }
  }

  async function handleChoice(optionLabel: "A" | "B", optionText: string) {
    if (!sceneData) return;

    const newContext: SceneContext = {
      scene,
      scene_text: sceneData.scene_text,
      choice_made: `${optionLabel}: ${optionText}`,
      used_maybe_phrase: sceneData.used_maybe_phrase,
      used_etiquette: sceneData.used_etiquette,
    };
    const nextHistory = [...sceneContextHistory, newContext];
    const nextScene = scene + 1;

    setSceneContextHistory(nextHistory);
    setScene(nextScene);
    setSceneData(null);
    setLoading(true);
    setError("");

    try {
      // Якщо наступна сцена — фінал, генеруємо напряму (не pre-generate)
      if (nextScene >= totalScenes) {
        pregenRef.current = {};
        const data = await fetchScene(baseParams(nextHistory, nextScene));
        setSceneData(data);
        return;
      }

      const pregenPromise = pregenRef.current[optionLabel];
      pregenRef.current = {};

      const data = pregenPromise ? await pregenPromise : await fetchScene(baseParams(nextHistory, nextScene));

      setSceneData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка.");
    } finally {
      setLoading(false);
    }
  }

  if (!hasParams) {
    return (
      <div className="min-h-screen bg-background px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-4xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_0_80px_rgba(56,189,248,0.15)]">
          <h1 className="font-lora text-4xl font-semibold">Оберіть параметри казки</h1>
          <p className="mt-4 text-slate-300">Щоб почати, поверніться на екран вибору та оберіть навичку, героя, локацію та вік.</p>
          <button
            type="button"
            onClick={() => router.push("/create")}
            className="mt-8 inline-flex items-center justify-center rounded-full bg-linear-to-r from-violet-500 via-cyan-400 to-amber-400 px-8 py-4 text-base font-semibold text-background"
          >
            Обрати казку
          </button>
        </div>
      </div>
    );
  }

  const caregiverSummary: CaregiverSummary | undefined = sceneData?.caregiver_summary;

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">

        {/* Хедер з прогресом */}
        <div className="rounded-4xl border border-white/10 bg-white/5 p-8 shadow-[0_0_90px_rgba(168,85,247,0.15)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-nunito text-sm uppercase tracking-[0.35em] text-cyan-200/90">Прогрес</p>
              <h1 className="mt-2 font-lora text-4xl font-semibold text-white">Чарівна історія</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Герой: {characterName}, локація: {locationLabels[location] ?? location}, навичка: {skillLabels[skill] ?? skill}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {progressDots.map((dot) => (
                <span
                  key={dot}
                  className={`h-3 w-3 rounded-full transition ${dot <= scene ? "bg-cyan-300" : "bg-white/15"}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Основний блок */}
        <div className="rounded-4xl border border-white/10 bg-white/5 p-8 shadow-[0_0_70px_rgba(56,189,248,0.12)]">
          {loading ? (
            <div className="flex min-h-60 items-center justify-center text-lg text-slate-200">
              Завантаження сцени…
            </div>
          ) : error ? (
            <div className="space-y-4">
              <p className="text-lg text-rose-200">{error}</p>
              <button
                type="button"
                onClick={() => loadScene(scene, sceneContextHistory)}
                className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-violet-500 via-cyan-400 to-amber-400 px-6 py-3 text-sm font-semibold text-background"
              >
                Спробувати ще раз
              </button>
            </div>
          ) : sceneData ? (
            <div className="space-y-8">

              {/* Текст сцени або фінал */}
              <div className="rounded-3xl border border-white/10 bg-[#15122f] p-7">
                <p className="font-lora text-2xl leading-9 text-slate-100">
                  {sceneData.ending ? "Кінець казки" : `Сцена ${scene}`}
                </p>
                <img
                  src={locationImage}
                  alt={locationLabels[location] ?? location}
                  style={{
                    width: "100%",
                    height: "180px",
                    objectFit: "cover",
                    borderRadius: "12px",
                    marginBottom: "1.2rem",
                    marginTop: "1.2rem",
                    display: "block",
                  }}
                />
                <p className="mt-5 whitespace-pre-line text-base leading-8 text-slate-200">
                  {sceneData.ending ? sceneData.ending : sceneData.scene_text}
                </p>
              </div>

              {/* Фінал — дитячий фінал + окремий блок для батьків */}
              {sceneData.ending ? (
                <div className="space-y-6">
                  {!showCaregiverSummary ? (
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setShowCaregiverSummary(true)}
                        className="inline-flex items-center justify-center rounded-full border border-[rgba(200,168,64,0.4)] bg-white/5 px-6 py-3 text-sm font-semibold text-[#c8a840] transition hover:bg-white/10"
                      >
                        Для батьків
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/create")}
                        className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-violet-500 via-cyan-400 to-amber-400 px-6 py-3 text-sm font-semibold text-background"
                      >
                        Почати нову казку
                      </button>
                    </div>
                  ) : (
                    <>
                      {caregiverSummary ? (
                        <div className="rounded-3xl border border-white/10 bg-[#15122f] p-6">
                          <p className="font-lora text-xl font-semibold text-white">{caregiverSummary.skill_name}</p>
                          <p className="mt-3 text-sm text-slate-300">{caregiverSummary.skill_in_plain_language}</p>
                          <p className="mt-3 text-sm text-slate-400">{caregiverSummary.why_it_matters}</p>
                          <p className="mt-4 text-base text-cyan-100">
                            <span className="font-semibold">Спробуйте сьогодні: </span>
                            {caregiverSummary.try_today}
                          </p>
                          <p className="mt-3 rounded-2xl bg-white/5 p-3 text-sm italic text-slate-200">
                            «{caregiverSummary.caregiver_phrase}»
                          </p>
                          {caregiverSummary.optional_extra_idea ? (
                            <p className="mt-3 text-sm text-slate-400">{caregiverSummary.optional_extra_idea}</p>
                          ) : null}
                          {caregiverSummary.childhood_memory_prompt ? (
                            <p className="mt-4 border-t border-white/10 pt-4 text-sm text-[#b0a8e0]">
                              {caregiverSummary.childhood_memory_prompt}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {sceneData.alternative ? (
                        <div className="rounded-3xl border border-white/10 bg-[#15122f] p-6">
                          <p className="font-lora text-xl font-semibold text-white">А якби...</p>
                          <p className="mt-3 text-sm text-[#6060a0]">{sceneData.alternative}</p>
                        </div>
                      ) : null}
                      {sceneData.parent_prompt ? (
                        <div className="rounded-3xl border border-[rgba(200,168,64,0.3)] bg-[#15122f] p-6">
                          <p className="font-lora text-xl font-semibold text-[#c8a840]">Запитайте у дитини:</p>
                          <p className="mt-3 text-base text-[#c8a840]">{sceneData.parent_prompt}</p>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => router.push("/create")}
                        className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-violet-500 via-cyan-400 to-amber-400 px-6 py-3 text-sm font-semibold text-background"
                      >
                        Почати нову казку
                      </button>
                    </>
                  )}
                </div>
              ) : (
                /* Вибори */
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleChoice("A", sceneData.choice_a)}
                    className="rounded-3xl border border-white/10 bg-cyan-500/10 px-6 py-5 text-left text-white transition hover:bg-cyan-500/15"
                  >
                    <p className="font-nunito text-sm uppercase tracking-[0.25em] text-cyan-200/90">Варіант A</p>
                    <p className="mt-3 text-base leading-7 text-slate-100">{sceneData.choice_a}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChoice("B", sceneData.choice_b)}
                    className="rounded-3xl border border-white/10 bg-amber-500/10 px-6 py-5 text-left text-white transition hover:bg-amber-500/15"
                  >
                    <p className="font-nunito text-sm uppercase tracking-[0.25em] text-amber-200/90">Варіант B</p>
                    <p className="mt-3 text-base leading-7 text-slate-100">{sceneData.choice_b}</p>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-60 items-center justify-center text-lg text-slate-200">
              Починаємо казку…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background px-6 py-10 text-white">
          <div className="mx-auto max-w-6xl rounded-4xl border border-white/10 bg-white/5 p-10 text-center text-lg text-slate-200">
            Завантаження історії…
          </div>
        </div>
      }
    >
      <StoryPageClient />
    </Suspense>
  );
}

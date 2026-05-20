"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const totalScenes = 4;

const locationImages: Record<string, string> = {
  "казковий ліс": "/locations/forest.svg",
  "підводне королівство": "/locations/underwater.svg",
  "хмарне місто": "/locations/clouds.svg",
  "стародавній замок": "/locations/castle.svg",
  "зоряне небо": "/locations/stars.svg",
  "затишне місто": "/locations/town.svg",
};

function StoryPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hero = searchParams.get("hero") || "";
  const place = searchParams.get("place") || "";
  const theme = searchParams.get("theme") || "";
  const locationImage = locationImages[place] ?? "/locations/forest.svg";

  const [scene, setScene] = useState<number>(1);
  const [history, setHistory] = useState<string[]>([]);
  const [sceneData, setSceneData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasParams = Boolean(hero && place && theme);

  const progressDots = useMemo(() => Array.from({ length: totalScenes }, (_, idx) => idx + 1), []);

  useEffect(() => {
    if (!hasParams) return;
    setScene(1);
    setHistory([]);
    setSceneData(null);
    setError("");
    loadScene(1, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, place, theme]);

  async function loadScene(nextScene: number, nextHistory: string[]) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          hero,
          place,
          history: nextHistory,
          scene: nextScene,
          totalScenes,
        }),
      });

      if (!response.ok) {
        throw new Error("Не вдалося завантажити сцену. Спробуйте ще раз.");
      }

      const data = await response.json();
      setSceneData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка під час завантаження.");
    } finally {
      setLoading(false);
    }
  }

  function handleChoice(optionLabel: string, optionText: string) {
    const nextHistory = [...history, `${optionLabel}: ${optionText}`];
    const nextScene = scene + 1;
    setHistory(nextHistory);
    setScene(nextScene);
    loadScene(nextScene, nextHistory);
  }

  if (!hasParams) {
    return (
      <div className="min-h-screen bg-background px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-4xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_0_80px_rgba(56,189,248,0.15)]">
          <h1 className="font-lora text-4xl font-semibold">Оберіть параметри казки</h1>
          <p className="mt-4 text-slate-300">Щоб почати, поверніться на екран вибору та оберіть героя, місце та тему.</p>
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

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="rounded-4xl border border-white/10 bg-white/5 p-8 shadow-[0_0_90px_rgba(168,85,247,0.15)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-nunito text-sm uppercase tracking-[0.35em] text-cyan-200/90">Прогрес</p>
              <h1 className="mt-2 font-lora text-4xl font-semibold text-white">Чарівна історія</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Герой: {hero}, місце: {place}, тема: {theme}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {progressDots.map((dot) => (
                <span
                  key={dot}
                  className={`h-3 w-3 rounded-full transition ${
                    dot <= scene ? "bg-cyan-300" : "bg-white/15"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-4xl border border-white/10 bg-white/5 p-8 shadow-[0_0_70px_rgba(56,189,248,0.12)]">
          {loading ? (
            <div className="flex min-h-60 items-center justify-center text-lg text-slate-200">Завантаження сцени…</div>
          ) : error ? (
            <div className="space-y-4">
              <p className="text-lg text-rose-200">{error}</p>
              <button
                type="button"
                onClick={() => loadScene(scene, history)}
                className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-violet-500 via-cyan-400 to-amber-400 px-6 py-3 text-sm font-semibold text-background"
              >
                Спробувати ще раз
              </button>
            </div>
          ) : sceneData ? (
            <div className="space-y-8">
              <div className="rounded-3xl border border-white/10 bg-[#15122f] p-7">
                <p className="font-lora text-2xl leading-9 text-slate-100">{sceneData.parent_prompt ? "Порада батькові" : `Сцена ${scene}`}</p>
                <img
                  src={locationImage}
                  alt={place}
                  style={{
                    width: "100%",
                    height: "180px",
                    objectFit: "cover",
                    borderRadius: "12px",
                    marginBottom: "1.2rem",
                    display: "block",
                  }}
                />
                <p className="mt-5 whitespace-pre-line text-base leading-8 text-slate-200">{sceneData.parent_prompt ?? sceneData.scene_text}</p>
              </div>

              {sceneData.parent_prompt ? (
                <div className="space-y-4">
                  <p className="text-slate-300">Казка дійшла до останнього моменту. Порадь дитині, що придумати далі.</p>
                  <button
                    type="button"
                    onClick={() => router.push("/create")}
                    className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-violet-500 via-cyan-400 to-amber-400 px-6 py-3 text-sm font-semibold text-background"
                  >
                    Почати нову казку
                  </button>
                </div>
              ) : (
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
            <div className="min-h-60 items-center justify-center text-lg text-slate-200">
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

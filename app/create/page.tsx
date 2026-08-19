"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// MVP-скоуп: 2 навички × 2 підтеми, 2 героя, 4 локації, 2 вікові режими.
// Джерело контенту: /content (skills, characters, locations, age-adapters) —
// UI-константи тут дублюють manifest.json для швидкого рендеру без файлового
// I/O на клієнті; людські назви мають збігатися з content/manifest.json.
type Skill = {
  key: string;
  label: string;
  emoji: string;
  subtopics: readonly { key: string; label: string }[];
};

const skills = [
  {
    key: "self_regulation",
    label: "Саморегуляція",
    emoji: "🌊",
    subtopics: [
      { key: "pause_before_action", label: "Пауза перед дією" },
      { key: "waiting", label: "Очікування" },
    ],
  },
  {
    key: "relationships",
    label: "Стосунки та взаємодія",
    emoji: "🤝",
    subtopics: [
      { key: "propose_shared_play", label: "Спільна гра" },
      { key: "resolve_disagreement", label: "Розв'язання суперечки" },
    ],
  },
] satisfies readonly Skill[];

const characters = [
  { key: "explorer", label: "Активний дослідник", emoji: "🦊", defaultName: "Іскра" },
  { key: "observer", label: "Уважний спостерігач", emoji: "🦉", defaultName: "Зоря" },
] as const;

const locations = [
  { key: "forest", label: "Ліс", emoji: "🌲" },
  { key: "space", label: "Космос", emoji: "🚀" },
  { key: "city", label: "Місто", emoji: "☁️" },
  { key: "home", label: "Дім", emoji: "🏠" },
] as const;

const ageBands = [
  { key: "3-5", label: "3–5 років" },
  { key: "6-8", label: "6–8 років" },
] as const;

function OptionRow<T extends { key: string; label: string; emoji?: string }>({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string;
  items: readonly T[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_0_60px_rgba(56,189,248,0.08)]">
      <h2 className="font-lora text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {items.map((item) => {
          const active = selected === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-left transition ${
                active
                  ? "border-cyan-300/80 bg-cyan-400/10 text-cyan-100 shadow-[0_0_20px_rgba(14,165,233,0.25)]"
                  : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              {item.emoji ? <span className="text-lg">{item.emoji}</span> : null}
              <span className="font-nunito text-sm font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CreatePage() {
  const router = useRouter();
  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>("");
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [selectedCharacterName, setSelectedCharacterName] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedAgeBand, setSelectedAgeBand] = useState<string>("");

  const currentSkill = skills.find((s) => s.key === selectedSkill);
  const currentCharacter = characters.find((c) => c.key === selectedCharacter);

  function onSelectSkill(key: string) {
    setSelectedSkill(key);
    setSelectedSubtopic(""); // підтема залежить від навички — скидаємо
  }

  const characterName = selectedCharacterName.trim() || currentCharacter?.defaultName || "";

  const canStart = Boolean(
    selectedSkill && selectedSubtopic && selectedCharacter && selectedLocation && selectedAgeBand,
  );

  const preview = useMemo(() => {
    if (!canStart || !currentSkill || !currentCharacter) {
      return "Оберіть навичку, героя, локацію та вік дитини, щоб побачити, як розгорнеться казка.";
    }
    const subtopicLabel = currentSkill.subtopics.find((s) => s.key === selectedSubtopic)?.label;
    const locationLabel = locations.find((l) => l.key === selectedLocation)?.label;
    return `У казці ${characterName} — ${currentCharacter.label.toLowerCase()}, потрапляє в ситуацію «${subtopicLabel}» у локації «${locationLabel}» (режим ${selectedAgeBand} років).`;
  }, [canStart, currentSkill, currentCharacter, characterName, selectedSubtopic, selectedLocation, selectedAgeBand]);

  function handleStart() {
    if (!canStart) return;
    const query = new URLSearchParams({
      skill: selectedSkill,
      skillSubtopic: selectedSubtopic,
      character: selectedCharacter,
      characterName,
      location: selectedLocation,
      ageBand: selectedAgeBand,
    });
    router.push(`/story?${query.toString()}`);
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="rounded-4xl border border-white/10 bg-white/5 p-8 shadow-[0_0_80px_rgba(131,58,180,0.18)] backdrop-blur-xl">
          <p className="font-nunito text-sm uppercase tracking-[0.35em] text-cyan-200/90">
            Вибір казки
          </p>
          <h1 className="mt-4 font-lora text-4xl font-semibold text-white">
            Створи свою пригоду
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
            Оберіть навичку, яку казка допоможе обговорити з дитиною, героя, локацію та вік — історія виросте з кожного вибору дитини.
          </p>
        </div>

        <OptionRow title="Навичка" items={skills} selected={selectedSkill} onSelect={onSelectSkill} />

        {currentSkill ? (
          <OptionRow
            title="Ситуація"
            items={currentSkill.subtopics}
            selected={selectedSubtopic}
            onSelect={setSelectedSubtopic}
          />
        ) : null}

        <OptionRow title="Герой" items={characters} selected={selectedCharacter} onSelect={setSelectedCharacter} />

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_0_60px_rgba(56,189,248,0.08)]">
          <label className="font-nunito text-sm font-semibold text-slate-200">
            Як звати героя? (необов&apos;язково)
          </label>
          <input
            value={selectedCharacterName}
            onChange={(event) => setSelectedCharacterName(event.target.value)}
            placeholder={currentCharacter ? `Наприклад, ${currentCharacter.defaultName}` : "Як звати героя?"}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300/80 focus:bg-white/10"
          />
          <p className="mt-3 text-sm text-slate-400">
            Якщо поле порожнє, буде використано ім&apos;я за замовчуванням для героя.
          </p>
        </div>

        <OptionRow title="Локація" items={locations} selected={selectedLocation} onSelect={setSelectedLocation} />
        <OptionRow title="Вік дитини" items={ageBands} selected={selectedAgeBand} onSelect={setSelectedAgeBand} />

        <div className="rounded-4xl border border-white/10 bg-white/5 p-8 shadow-[0_0_80px_rgba(59,130,246,0.14)]">
          <h2 className="font-lora text-xl font-semibold text-white">Прев&apos;ю казки</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200">{preview}</p>
          <button
            type="button"
            disabled={!canStart}
            onClick={handleStart}
            className={`mt-8 inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-semibold transition ${
              canStart
                ? "bg-linear-to-r from-violet-500 via-cyan-400 to-amber-400 text-background shadow-[0_0_30px_rgba(168,85,247,0.35)]"
                : "cursor-not-allowed bg-white/10 text-slate-400"
            }`}
          >
            Почати казку
          </button>
        </div>
      </div>
    </div>
  );
}

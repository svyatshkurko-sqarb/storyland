"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const heroes = [
  { label: "Добрий дракон", emoji: "🐉" },
  { label: "Смілива феєчка", emoji: "🧚" },
  { label: "Мандрівний кіт", emoji: "🐱" },
  { label: "Хоробрий лис", emoji: "🦊" },
  { label: "Мудрий вовк", emoji: "🐺" },
  { label: "Казкова сова", emoji: "🦉" },
];

const places = [
  { label: "казковий ліс", emoji: "🌲" },
  { label: "мрійливе озеро", emoji: "🏞️" },
  { label: "старовинний замок", emoji: "🏰" },
  { label: "хмарне місто", emoji: "☁️" },
  { label: "чудовий сад", emoji: "🌸" },
  { label: "місячна долина", emoji: "🌙" },
];

const themes = [
  { label: "дружба", emoji: "🤝" },
  { label: "магія", emoji: "✨" },
  { label: "сміливість", emoji: "🛡️" },
  { label: "таємниці", emoji: "🕯️" },
  { label: "веселка", emoji: "🌈" },
  { label: "подорож", emoji: "🚀" },
];

function OptionRow({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string;
  items: { label: string; emoji: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_0_60px_rgba(56,189,248,0.08)]">
      <h2 className="font-lora text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {items.map((item) => {
          const active = selected === item.label;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onSelect(item.label)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-left transition ${
                active
                  ? "border-cyan-300/80 bg-cyan-400/10 text-cyan-100 shadow-[0_0_20px_rgba(14,165,233,0.25)]"
                  : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <span className="text-lg">{item.emoji}</span>
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
  const [selectedHero, setSelectedHero] = useState("");
  const [selectedPlace, setSelectedPlace] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("");

  const canStart = selectedHero && selectedPlace && selectedTheme;

  const preview = useMemo(() => {
    if (!canStart) {
      return "Оберіть героя, місце та тему, щоб побачити, як розгорнеться казка.";
    }

    return `У казці ${selectedHero} вирушає до ${selectedPlace}, де трапляється історія про ${selectedTheme}.`;
  }, [canStart, selectedHero, selectedPlace, selectedTheme]);

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
            Вибери героя, місце та тему. Потім розкажи історію, яка виросте з кожного вибору.
          </p>
        </div>

        <OptionRow title="Герой" items={heroes} selected={selectedHero} onSelect={setSelectedHero} />
        <OptionRow title="Місце" items={places} selected={selectedPlace} onSelect={setSelectedPlace} />
        <OptionRow title="Тема" items={themes} selected={selectedTheme} onSelect={setSelectedTheme} />

        <div className="rounded-4xl border border-white/10 bg-white/5 p-8 shadow-[0_0_80px_rgba(59,130,246,0.14)]">
          <h2 className="font-lora text-xl font-semibold text-white">Прев'ю казки</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200">{preview}</p>
          <button
            type="button"
            disabled={!canStart}
            onClick={() =>
              router.push(
                `/story?hero=${encodeURIComponent(selectedHero)}&place=${encodeURIComponent(
                  selectedPlace,
                )}&theme=${encodeURIComponent(selectedTheme)}`,
              )
            }
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

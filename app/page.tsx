import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(141,92,246,0.35),transparent_30%),radial-gradient(circle_at_30%_20%,rgba(12,211,209,0.22),transparent_24%),radial-gradient(circle_at_85%_80%,rgba(255,189,74,0.18),transparent_22%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full rounded-[36px] border border-white/10 bg-white/5 p-10 shadow-[0_0_100px_rgba(111,71,255,0.18)] backdrop-blur-xl">
          <p className="font-nunito text-sm uppercase tracking-[0.35em] text-cyan-200/90">
            Інтерактивна казка
          </p>
          <h1 className="mt-6 font-lora text-5xl font-semibold leading-tight text-white sm:text-6xl">
            Storyland
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
            Створи теплу українську казку і поринь у чарівний світ пригод. Обери героя, місце та тему або почни вже готову історію.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/create"
              className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-violet-500 via-cyan-400 to-amber-400 px-8 py-4 text-base font-semibold text-background transition hover:scale-[1.01]"
            >
              Створити казку
            </Link>
            <Link
              href="/story?hero=Добрий%20дракон&place=казковий%20ліс&theme=дружба"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white transition hover:border-white/40"
            >
              Готова казка
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

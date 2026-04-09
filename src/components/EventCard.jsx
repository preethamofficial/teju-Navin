import { motion } from "motion/react";

export function EventCard({ title, date, time, image, venueLine, overlay = "rose" }) {
  const dateMatch = date.match(/^(\d+)(st|nd|rd|th)\s+(.*)$/);
  const dayNumber = dateMatch?.[1] ?? date;
  const daySuffix = dateMatch?.[2] ?? "";
  const monthLine = dateMatch?.[3] ?? "";
  const overlayClass =
    overlay === "rose"
      ? "bg-[linear-gradient(180deg,rgba(38,9,16,0.18),rgba(98,22,39,0.34),rgba(75,18,33,0.58))]"
      : "bg-[linear-gradient(180deg,rgba(25,10,27,0.18),rgba(112,40,92,0.34),rgba(78,20,58,0.6))]";

  return (
    <motion.article
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-[2rem] border border-white/18 bg-[#40151f] p-0 text-white shadow-[0_24px_70px_rgba(88,27,43,0.2)]"
      aria-label={`${title} invitation card`}
    >
      <img
        src={image}
        alt={`${title} invitation design`}
        className="absolute inset-0 h-full w-full object-cover object-center transition duration-700 group-hover:scale-[1.03]"
      />
      <div className={`absolute inset-0 ${overlayClass}`} />
      <div className="pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-10 bottom-8 h-px bg-gradient-to-r from-transparent via-[#ffe2b5]/70 to-transparent" />

      <div className="relative z-10 flex min-h-[28rem] flex-col items-center justify-center px-6 py-8 text-center sm:min-h-[31rem] sm:px-8">
        <div className="w-full max-w-[18rem] rounded-[2rem] border border-[#f3d8b1]/40 bg-[linear-gradient(180deg,rgba(95,33,36,0.26),rgba(37,12,17,0.36))] px-5 py-6 shadow-[0_24px_60px_rgba(13,4,7,0.22)] backdrop-blur-[5px] sm:max-w-[20rem] sm:px-6">
          <p className="font-script text-[3.2rem] leading-none text-[#fff0d5] drop-shadow-[0_4px_24px_rgba(0,0,0,0.18)] sm:text-[4.4rem]">
            {title}
          </p>

          <div className="mx-auto mt-3 h-px w-28 bg-gradient-to-r from-transparent via-white/85 to-transparent" />

          <p className="mt-5 font-display text-[3rem] leading-none text-white sm:text-[4rem]">
            {dayNumber}
            {daySuffix ? <sup className="ml-1 text-[0.4em] italic">{daySuffix}</sup> : null}
          </p>
          <p className="mt-1 text-lg text-[#fff3df] sm:text-xl">{monthLine}</p>

          <p className="mt-5 text-base font-semibold tracking-[0.08em] text-[#fff3e2] sm:text-xl">{time}</p>

          <div className="mt-6 space-y-2 text-center text-[#ffe8d1]">
            <p className="text-[0.72rem] uppercase tracking-[0.34em] text-[#ffd9ae]">Venue</p>
            <p className="font-display text-[2rem] leading-tight sm:text-[2.4rem]">{venueLine[0]}</p>
            <p className="text-sm leading-7 text-[#fff0de] sm:text-base">{venueLine[1]}</p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

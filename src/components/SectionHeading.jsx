export function SectionHeading({ eyebrow, title, subtitle, align = "left" }) {
  const alignClass = align === "center" ? "text-center items-center" : "text-left items-start";
  const dividerClass = align === "center" ? "mx-auto" : "";

  return (
    <div className={`flex flex-col gap-3 ${alignClass}`}>
      <span className="section-eyebrow">{eyebrow}</span>
      <h2 className="font-display text-[2.2rem] leading-none text-[#5b1f2a] sm:text-[2.8rem]">
        {title}
      </h2>
      <div className={`h-px w-24 bg-gradient-to-r from-transparent via-[#c99153] to-transparent ${dividerClass}`} />
      <p className="max-w-2xl text-sm leading-7 text-[#69413f] sm:text-base">
        {subtitle}
      </p>
    </div>
  );
}

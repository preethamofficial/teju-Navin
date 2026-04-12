export function SectionHeading({ eyebrow, title, subtitle, align = "left" }) {
  const alignClass = align === "center" ? "text-center items-center" : "text-left items-start";
  const dividerClass = align === "center" ? "mx-auto" : "";

  return (
    <div className={`flex flex-col gap-3 ${alignClass}`}>
      <span className="section-eyebrow">{eyebrow}</span>
      <h2 className="royal-title text-[2.35rem] leading-[0.95] text-[#5b1f2a] sm:text-[3rem]">
        {title}
      </h2>
      <div className={`section-divider ${dividerClass}`} />
      <p className="section-subtitle sm:text-base">
        {subtitle}
      </p>
    </div>
  );
}

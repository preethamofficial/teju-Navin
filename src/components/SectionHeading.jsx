export function SectionHeading({ eyebrow, title, subtitle, align = "center", subtitleClassName = "" }) {
  const alignClass = align === "center" ? "text-center items-center" : "text-left items-start";
  const dividerClass = align === "center" ? "mx-auto" : "";

  return (
    <div className={`flex flex-col gap-3 ${alignClass}`}>
      <span className="section-eyebrow">{eyebrow}</span>
      <h2 className="royal-title royal-title-embossed text-[3rem] leading-[0.9] sm:text-[3.8rem]">
        {title}
      </h2>
      <div className={`section-divider ${dividerClass}`} />
      <p className={`section-subtitle sm:text-base ${subtitleClassName}`}>
        {subtitle}
      </p>
    </div>
  );
}

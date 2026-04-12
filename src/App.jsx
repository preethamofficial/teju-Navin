import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import introPoster from "../assets/intro-poster.svg";
import introVideo from "../assets/wedding-intro.mp4";
import weddingTemplateHero from "../assets/wedding-template-hero.jpg";
import palaceScene from "../analysis-frames/frame-05.jpg";
import invitationScene from "../analysis-frames/frame-15.jpg";
import receptionScene from "../analysis-frames/candidates/frame-22.jpg";
import muhurthamScene from "../analysis-frames/candidates/frame-29_5.jpg";
import { EventCard } from "./components/EventCard";
import { IntroVideo } from "./components/IntroVideo";
import { MapPinIcon } from "./components/Icons";
import { PhotoGallerySection } from "./components/PhotoGallerySection";
import { SectionHeading } from "./components/SectionHeading";

const eventDetails = [
  {
    title: "Reception",
    date: "22nd April 2026",
    time: "6:30 PM onwards",
    image: receptionScene,
    overlay: "rose",
  },
  {
    title: "Muhurtham",
    date: "23rd April 2026",
    time: "9:30 AM to 10:15 AM",
    image: muhurthamScene,
    overlay: "violet",
  },
];

function InvitationHero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      className="hero-scene mx-auto max-w-4xl overflow-hidden rounded-[2.2rem] border border-white/18 px-4 py-4 text-center shadow-[0_30px_80px_rgba(64,21,31,0.22)] sm:px-5 sm:py-5"
      style={{ backgroundImage: `url(${invitationScene})` }}
    >
      <div className="hero-veil rounded-[2rem] px-4 py-7 sm:px-8 sm:py-9">
        <div className="hero-invite-panel mx-auto max-w-3xl rounded-[2rem] border border-[#f2ddbb]/68 px-5 py-6 text-white sm:px-7">
          <p className="hero-invite-kicker">Wedding Invitation</p>
          <h2 className="hero-invite-title">Together with our families</h2>
          <p className="hero-invite-note">We invite you and your loved ones to celebrate our wedding.</p>

          <div className="hero-meta" aria-label="Wedding details">
            <span>23 April 2026</span>
            <span>RG Convention Hall</span>
          </div>

          <div className="mt-4 flex flex-col items-center justify-center gap-5 sm:mt-5">
            <div className="hero-couple-frame">
              <img
                src={weddingTemplateHero}
                alt="Traditional Hindu wedding ceremony illustration"
                className="hero-couple-image"
              />

              <div className="hero-couple-overlay">
                <div className="hero-couple-shell">
                  <p className="hero-couple-role">The Bride</p>
                  <h1 className="hero-couple-name">
                    Teja Shree <span className="uppercase">A</span>
                  </h1>

                  <div className="hero-couple-divider" aria-hidden="true">
                    <span />
                    <span className="hero-couple-divider-core">&amp;</span>
                    <span />
                  </div>

                  <p className="hero-couple-role">The Groom</p>
                  <h1 className="hero-couple-name hero-couple-name--groom">
                    Navin Reddy S
                  </h1>
                </div>
              </div>
            </div>
          </div>

          <p className="hero-invite-footer">We request the honor of your presence and blessings.</p>
        </div>
      </div>
    </motion.section>
  );
}

function VenueSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.28 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="section-shell pt-14"
    >
      <div
        className="relative overflow-hidden rounded-[2rem] border border-white/15 p-6 text-white shadow-[0_26px_70px_rgba(64,21,31,0.24)] sm:p-8"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(26,9,15,0.32), rgba(59,19,27,0.68)), url(${palaceScene})` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,235,204,0.18),transparent_22%)]" />
        <div className="relative z-10 grid gap-6 md:grid-cols-[1.15fr_auto] md:items-end">
          <div className="flex flex-col gap-3">
            <span className="section-eyebrow border-white/18 bg-white/10 !text-[#ffe7c1]">Venue</span>
            <h2 className="royal-title text-[2.35rem] leading-[0.95] text-white sm:text-[3.05rem]">RG Convention Hall</h2>
            <p className="max-w-2xl text-base leading-7 text-[#fff1de] sm:text-lg">
              Hirebidanur, Chikkaballapura Road, Gauribidanur
            </p>
            <p className="max-w-2xl text-sm leading-7 text-[#fff1de]/92 sm:text-base">
              Tap below to open the location in Google Maps and reach the celebration with ease.
            </p>
          </div>

          <a
            href="https://maps.app.goo.gl/rnCemxXzGqhPc4E96"
            target="_blank"
            rel="noreferrer"
            className="group relative z-10 inline-flex items-center gap-4 rounded-[1.6rem] border border-[#f1d7ae]/35 bg-[linear-gradient(135deg,rgba(255,246,233,0.18),rgba(245,228,198,0.16))] px-5 py-4 text-left shadow-[0_18px_42px_rgba(17,7,10,0.16)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(17,7,10,0.24)]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6a2330] text-white shadow-[0_12px_30px_rgba(106,35,48,0.2)]">
              <MapPinIcon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[0.72rem] uppercase tracking-[0.28em] text-[#f8d7aa]">View on map</span>
              <span className="royal-title mt-1 block text-3xl text-white">RG Convention Hall</span>
            </span>
          </a>
        </div>
      </div>
    </motion.section>
  );
}

export default function App() {
  const invitationRef = useRef(null);
  const [introFinished, setIntroFinished] = useState(false);

  useEffect(() => {
    if (!introFinished) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      invitationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [introFinished]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#2d121a]">
      <AnimatePresence>
        {!introFinished ? (
          <IntroVideo src={introVideo} poster={introPoster} onComplete={() => setIntroFinished(true)} />
        ) : null}
      </AnimatePresence>

      <div className="ornate-background relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="mandala-burst left-[-8rem] top-[-8rem]" />
          <div className="mandala-burst bottom-10 right-[-9rem] scale-[1.15]" />
          <div className="absolute left-1/2 top-10 h-40 w-40 -translate-x-1/2 rounded-full bg-[#d59d5f]/14 blur-3xl" />
        </div>

        <header
          ref={invitationRef}
          className="section-shell relative z-10 pb-6"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.25rem)" }}
        >
          <div className="pt-6 sm:pt-10">
            <InvitationHero />
          </div>
        </header>

        <main className="relative z-10 pb-10">
          <section id="events" className="section-shell pt-10">
            <SectionHeading
              eyebrow="Wedding Celebrations"
              title="Reception & Muhurtham"
              subtitle="Two beautiful gatherings, each filled with joy, blessings, and the warmth of family."
              align="center"
            />

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {eventDetails.map((eventDetail) => (
                <EventCard
                  key={eventDetail.title}
                  title={eventDetail.title}
                  date={eventDetail.date}
                  time={eventDetail.time}
                  image={eventDetail.image}
                  overlay={eventDetail.overlay}
                  venueLine={["R.G. Convention Hall", "Hirebidanur, Chikkaballapura Road, Gauribidanur"]}
                />
              ))}
            </div>
          </section>

          <VenueSection />
          <PhotoGallerySection />
        </main>
      </div>
    </div>
  );
}

import Image from "next/image";
import headshot from "../../public/headshot.jpg";
import { INTRO } from "../cv";

// One line-icon set, drawn on a 24 grid with a 2.25-unit rounded stroke so all four read as a family.
const LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/roshankern",
    icon: (
      <>
        <path d="M9.5 21v-3c0-1.1-.5-1.9-1.4-2.4C5.6 14.6 3.5 12.6 3.5 10c0-1.3.4-2.5 1.1-3.5L4.5 3l3.6 1.6C9.3 4.2 10.6 4 12 4s2.7.2 3.9.6L19.5 3l-.1 3.5c.7 1 1.1 2.2 1.1 3.5 0 2.6-2.1 4.6-4.6 5.6-.9.5-1.4 1.3-1.4 2.4v3" />
        <path d="M9.5 20.5c-2.9 0-5-1.3-6.5-3.7" />
      </>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/roshan-kern",
    icon: (
      <>
        <circle cx="5.5" cy="5" r="1.65" fill="currentColor" stroke="none" />
        <path d="M5.5 10v9.5" />
        <path d="M10.5 19.5V10m0 4.5a4 4 0 0 1 8 0v5" />
      </>
    ),
  },
  {
    label: "Email",
    href: "mailto:rkern@mit.edu",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m3.5 7 7.4 5.2a2 2 0 0 0 2.2 0L20.5 7" />
      </>
    ),
  },
  {
    label: "CV",
    href: "/Roshan_Kern_CV.pdf",
    icon: (
      <>
        <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8Z" />
        <path d="M14 3v3.5A1.5 1.5 0 0 0 15.5 8H19M9 13h6M9 17h6" />
      </>
    ),
  },
];

/** Headshot, name and links: the first full screen of the home page. */
export function Hero() {
  return (
    <section className="flex min-h-dvh flex-col items-center justify-center px-6">
      <Image
        src={headshot}
        alt="Roshan Kern"
        priority
        sizes="384px"
        className="mb-8 h-80 w-80 rounded-full object-cover sm:h-96 sm:w-96"
      />
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-4xl">Roshan Kern</h1>

      <nav className="mt-12 flex items-center gap-10">
        {LINKS.map(({ label, href, icon }) => (
          <a
            key={label}
            href={href}
            aria-label={label}
            {...(href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            className="group relative transition-opacity hover:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
          >
            <svg
              className="h-7 w-7 sm:h-8 sm:w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {icon}
            </svg>
            <span className="absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap text-sm text-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {label}
            </span>
          </a>
        ))}
      </nav>

      <p className="mt-12 max-w-xl text-center text-lg leading-relaxed text-black/70">{INTRO}</p>
    </section>
  );
}

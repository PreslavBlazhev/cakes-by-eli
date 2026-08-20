import { cn } from "@/lib/cn";

/** Proper brand glyphs — never the letter "f" or "ig" as a stand-in. */
export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn("size-[18px]", className)}
      fill="currentColor"
    >
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn("size-[18px]", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SocialLinks({
  facebookUrl,
  instagramUrl,
  tone = "light",
  className,
}: {
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tone?: "light" | "dark";
  className?: string;
}) {
  const links: { href: string; label: string; icon: React.ReactNode }[] = [];
  if (facebookUrl) {
    links.push({
      href: facebookUrl,
      label: "Facebook на Cakes by ELI",
      icon: <FacebookIcon />,
    });
  }
  if (instagramUrl) {
    links.push({
      href: instagramUrl,
      label: "Instagram на Cakes by ELI",
      icon: <InstagramIcon />,
    });
  }

  if (links.length === 0) return null;

  return (
    <ul className={cn("flex items-center gap-2.5", className)}>
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer me"
            aria-label={link.label}
            className={cn(
              "flex size-10 items-center justify-center rounded-full border transition-colors duration-200",
              tone === "dark"
                ? "border-paper/25 text-paper hover:border-paper hover:bg-paper hover:text-ink"
                : "border-line text-ink hover:border-ink hover:bg-ink hover:text-paper",
            )}
          >
            {link.icon}
          </a>
        </li>
      ))}
    </ul>
  );
}

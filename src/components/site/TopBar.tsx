import Link from "next/link";

import type { Announcement } from "@/server/queries/settings";

/**
 * The narrow strip above the header. An active announcement replaces the
 * standing message so the owner has one obvious place to say
 * „Не приемаме поръчки за 24–26 декември“.
 */
export function TopBar({
  text,
  announcement,
}: {
  text: string;
  announcement: Announcement | null;
}) {
  if (announcement) {
    return (
      <div className="bg-rose-dark text-[0.82rem] text-paper">
        <div className="wrap flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2.5 text-center tracking-[0.02em]">
          <span className="font-semibold">{announcement.text}</span>
          {announcement.linkUrl ? (
            <Link
              href={announcement.linkUrl}
              className="underline underline-offset-4 hover:opacity-80"
            >
              {announcement.linkLabel || "Виж повече"}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  if (!text) return null;

  return (
    <div className="bg-ink text-[0.8rem] text-[#f8ede6]">
      <p className="wrap py-2.5 text-center tracking-[0.04em]">{text}</p>
    </div>
  );
}

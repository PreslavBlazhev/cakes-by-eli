"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  OPEN_CONSENT_EVENT,
  classifyHref,
  clearAnalyticsCookies,
  isGtmLoaded,
  loadGtm,
  readConsent,
  revokeConsentInGtm,
  track,
  writeConsent,
  type ConsentChoice,
} from "@/lib/analytics";

/**
 * Consent banner + GTM loader + the site-wide event wiring.
 *
 * Mounted once in the public layout (not in /admin or on order summaries,
 * whose URLs carry a private token). Until the visitor accepts, it renders
 * only the banner and makes no request to Google.
 *
 * Page views are deliberately NOT pushed from here. The GA4 Google tag in
 * the container already sends one per page load and one per client-side
 * navigation (Enhanced measurement → "Page changes based on browser history
 * events"); a second source would count every page twice.
 */
export function Analytics() {
  // undefined = not read yet (SSR / first paint), null = no choice made.
  const [consent, setConsent] = useState<ConsentChoice | null | undefined>(
    undefined,
  );
  const [bannerOpen, setBannerOpen] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    // The cookie is only readable after mount; one extra render is intended.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(stored);
    setBannerOpen(stored === null);

    const reopen = () => setBannerOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (consent === "granted") loadGtm();
  }, [consent]);

  const choose = useCallback((choice: ConsentChoice) => {
    const wasLoaded = isGtmLoaded();
    writeConsent(choice);
    setConsent(choice);
    setBannerOpen(false);

    if (choice === "denied") {
      clearAnalyticsCookies();
      if (wasLoaded) {
        // A loaded container cannot be unloaded; tell it consent is gone
        // and start a clean page so nothing more runs.
        revokeConsentInGtm();
        window.location.reload();
      }
    }
  }, []);

  return (
    <>
      {consent === "granted" ? (
        <ContactClicks />
      ) : null}
      {bannerOpen ? (
        <ConsentBanner current={consent ?? null} onChoose={choose} />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------ Contact clicks */

function areaOf(el: Element): string {
  const tagged = el.closest<HTMLElement>("[data-analytics-area]");
  if (tagged?.dataset.analyticsArea) return tagged.dataset.analyticsArea;
  if (el.closest("header")) return "header";
  if (el.closest("footer")) return "footer";
  return "content";
}

/** One delegated listener instead of wiring every phone/e-mail/social link. */
function ContactClicks() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.type === "auxclick" && event.button !== 1) return;
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]");
      if (!link) return;

      const kind = classifyHref(link.getAttribute("href") ?? "");
      if (!kind) return;

      const link_area = areaOf(link);
      if (kind.kind === "phone") track({ event: "click_phone", link_area });
      else if (kind.kind === "email") track({ event: "click_email", link_area });
      else {
        track({
          event: "click_social",
          social_network: kind.network,
          link_area,
        });
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);

  return null;
}

/* -------------------------------------------------------------- Banner */

function ConsentBanner({
  current,
  onChoose,
}: {
  current: ConsentChoice | null;
  onChoose: (choice: ConsentChoice) => void;
}) {
  return (
    <div
      role="region"
      aria-label="Настройки за бисквитки"
      className="fixed inset-x-0 bottom-0 z-[250] p-3 sm:p-5"
    >
      <div className="mx-auto max-w-[760px] rounded-[3px] border border-line bg-paper p-5 shadow-[0_18px_50px_-20px_rgba(36,26,21,0.45)] sm:p-6">
        <p className="text-[0.62rem] uppercase tracking-[0.24em] text-ink-faint">
          Бисквитки
        </p>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-soft">
          Използваме аналитични бисквитки (Google Analytics чрез Google Tag
          Manager), за да разберем кои страници се посещават и как да
          подобрим сайта. Те се зареждат само с вашето съгласие. Технически
          необходимите бисквитки работят винаги.{" "}
          <Link
            href="/privacy#cookies"
            className="link-underline text-ink hover:text-rose-dark"
          >
            Научете повече
          </Link>
          .
        </p>
        {current ? (
          <p className="mt-2 text-[0.8rem] text-ink-faint">
            Текущ избор:{" "}
            {current === "granted" ? "приети аналитични" : "отказани аналитични"}
            .
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChoose("denied")}
          >
            Отказвам
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onChoose("granted")}
          >
            Приемам
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Footer link that reopens the banner so the choice can be changed later. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
    >
      Настройки за бисквитки
    </button>
  );
}

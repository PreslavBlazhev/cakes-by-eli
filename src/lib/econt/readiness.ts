import { econtSenderGaps, env } from "@/lib/env";
import { econtIsConfigured } from "./client";
import { getOffices } from "./nomenclatures";

export type EcontReadiness = { ready: boolean; problems: string[] };

/**
 * Whether a waybill can be issued right now, and if not, exactly why.
 *
 * Goes one step further than the static configuration warnings: a sender
 * office code must exist in Econt's current office list, otherwise Econt
 * rejects the label only after the owner has filled in the whole form.
 */
export async function econtReadiness(): Promise<EcontReadiness> {
  const problems: string[] = [];

  if (!econtIsConfigured()) {
    problems.push(
      "ECONT_USERNAME / ECONT_PASSWORD липсват — товарителници не могат да се създават.",
    );
  }
  problems.push(...econtSenderGaps());

  const officeCode = env.ECONT_SENDER_OFFICE_CODE;
  if (officeCode && econtIsConfigured()) {
    try {
      const offices = await getOffices();
      if (!offices.some((office) => office.code === officeCode)) {
        problems.push(
          `ECONT_SENDER_OFFICE_CODE „${officeCode}“ не е намерен сред офисите на Еконт.`,
        );
      }
    } catch {
      problems.push(
        "Офисът на подателя не може да бъде проверен — Еконт не отговаря. Опитайте отново след малко.",
      );
    }
  }

  return { ready: problems.length === 0, problems };
}

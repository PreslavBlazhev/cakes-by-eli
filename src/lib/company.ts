/**
 * Legal entity behind the "Cakes by ELI" brand.
 *
 * The brand name stays in the owner-managed site settings; this is the
 * registered trader shown in legal notices, the footer, structured data and
 * e-mails. No VAT number is listed on purpose — only what the owner confirmed.
 */
export const COMPANY = {
  legalName: "ПРО АУДИО РКД ООД",
  eik: "206330964",
} as const;

/** "ПРО АУДИО РКД ООД · ЕИК 206330964" */
export const COMPANY_LINE = `${COMPANY.legalName} · ЕИК ${COMPANY.eik}`;

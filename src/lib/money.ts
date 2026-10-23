// Money is stored and computed in kobo (1 naira = 100 kobo).

export function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Commission on an amount, rounded to the nearest kobo (PRD §17, §18). */
export function splitCommission(amountKobo: number, percent: number) {
  const commissionKobo = Math.round((amountKobo * percent) / 100);
  return { commissionKobo, netKobo: amountKobo - commissionKobo };
}

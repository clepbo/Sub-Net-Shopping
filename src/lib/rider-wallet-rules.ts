// Pure rules for the rider cash wallet (see rider-wallet.ts).

/** Paused: holding at least the limit in unremitted cash (balance ≤ −limit). */
export function overLimit(balanceKobo: number, limitKobo: number) {
  return balanceKobo <= -limitKobo;
}

/** Whether taking a cash order of this size would push the rider past the limit. */
export function cashJobAllowed(balanceKobo: number, orderTotalKobo: number, limitKobo: number) {
  return !overLimit(balanceKobo, limitKobo) && balanceKobo - orderTotalKobo > -limitKobo;
}


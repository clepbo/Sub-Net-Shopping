import "server-only";
import { db } from "./db";

/** Defaults from the PRD; admins can change them under Settings. */
export const SETTING_DEFAULTS = {
  supermarketCommissionPercent: "10",
  riderCommissionPercent: "7",
  /** Naira. */
  deliveryBaseFee: "500",
  /** Naira per km of road distance. */
  deliveryPerKm: "150",
  deliveryMaxKm: "20",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.platformSetting.findMany({ where: { key: { in: Object.keys(SETTING_DEFAULTS) } } });
  const out = { ...SETTING_DEFAULTS } as Record<SettingKey, string>;
  for (const row of rows) out[row.key as SettingKey] = row.value;
  return out;
}

export async function saveSettings(values: Partial<Record<SettingKey, string>>, updatedBy: string) {
  await db.$transaction(
    Object.entries(values).map(([key, value]) =>
      db.platformSetting.upsert({
        where: { key },
        create: { key, value: String(value), updatedBy },
        update: { value: String(value), updatedBy },
      }),
    ),
  );
}

/** Delivery pricing from settings, in kobo. */
export async function deliveryRates() {
  const s = await getSettings();
  return {
    baseKobo: Math.round(Number(s.deliveryBaseFee) * 100),
    perKmKobo: Math.round(Number(s.deliveryPerKm) * 100),
    maxKm: Number(s.deliveryMaxKm),
  };
}

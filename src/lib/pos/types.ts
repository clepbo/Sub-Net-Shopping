// POS / inventory integration contract (PRD §9). Supermarkets use different
// POS systems, so each provider gets an adapter that maps its catalogue onto
// these records; the sync job is provider-agnostic.

export type PosItem = {
  /** The store's SKU / product code. */
  sku: string;
  name: string;
  barcode?: string;
  priceKobo: number;
  stockQuantity?: number;
  imageUrl?: string;
  /** Provider's own ID for the item. */
  externalRef?: string;
};

export interface PosAdapter {
  /** Stable identifier stored on Supermarket.posProvider. */
  id: string;
  label: string;
  /** Fetches the store's current catalogue from the POS. */
  fetchItems(config: { supermarketId: string }): Promise<PosItem[]>;
}

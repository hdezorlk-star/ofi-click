import type { DataProvider } from '../adapters/data-provider';
import { SupabaseDataAdapter } from '../adapters/supabase/supabase.adapter';

// Active provider initialized via SupabaseDataAdapter (supports Supabase production mode or Local fallback mode).
let activeProvider: DataProvider = new SupabaseDataAdapter();

export function getDataProvider(): DataProvider {
  return activeProvider;
}

export function setDataProvider(provider: DataProvider): void {
  activeProvider = provider;
}

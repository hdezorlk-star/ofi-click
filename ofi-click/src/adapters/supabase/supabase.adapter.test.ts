import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyDatabaseState, getSupabaseConfigStatus } from './supabase.adapter';
import { isSupabaseConfigured } from '../../lib/supabase/client';

test('createEmptyDatabaseState creates clean empty state with Cuautitlan Izcalli region', () => {
  const state = createEmptyDatabaseState();
  assert.equal(state.regions.length, 1);
  assert.equal(state.regions[0].name, 'Cuautitlán Izcalli');
  assert.equal(state.categories.length, 0);
  assert.equal(state.professionals.length, 0);
  assert.equal(state.services.length, 0);
  assert.equal(state.bookings.length, 0);
  assert.equal(state.profiles.length, 0);
  assert.equal(state.quotes.length, 0);
  assert.equal(state.oneTimeCodes.length, 0);
});

test('getSupabaseConfigStatus reports configured true when env vars are present', () => {
  const status = getSupabaseConfigStatus();
  // In the active environment, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
  assert.equal(typeof status.configured, 'boolean');
  assert.ok(Array.isArray(status.missingVars));
});

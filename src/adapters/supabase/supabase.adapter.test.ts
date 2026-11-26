import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyDatabaseState, getSupabaseConfigStatus } from './supabase.adapter';
import { normalizeSupabaseUrl } from '../../lib/supabase/client';

test('normalizeSupabaseUrl strips /rest/v1 and trailing slashes cleanly', () => {
  assert.equal(
    normalizeSupabaseUrl('https://ymaiylsnqndyhwsqypon.supabase.co/rest/v1/'),
    'https://ymaiylsnqndyhwsqypon.supabase.co'
  );
  assert.equal(
    normalizeSupabaseUrl('https://ymaiylsnqndyhwsqypon.supabase.co/'),
    'https://ymaiylsnqndyhwsqypon.supabase.co'
  );
  assert.equal(
    normalizeSupabaseUrl('https://ymaiylsnqndyhwsqypon.supabase.co'),
    'https://ymaiylsnqndyhwsqypon.supabase.co'
  );
});

test('createEmptyDatabaseState creates clean empty state with Cuautitlan Izcalli region and zero fictional records', () => {
  const state = createEmptyDatabaseState();
  assert.equal(state.regions.length, 1);
  assert.equal(state.regions[0].name, 'Cuautitlán Izcalli');
  assert.ok(state.regions[0].colonias.length >= 90);
  assert.equal(state.categories.length, 0);
  assert.equal(state.professionals.length, 0);
  assert.equal(state.services.length, 0);
  assert.equal(state.bookings.length, 0);
  assert.equal(state.profiles.length, 0);
  assert.equal(state.quotes.length, 0);
  assert.equal(state.oneTimeCodes.length, 0);
  assert.equal(JSON.stringify(state).includes('Mariana Velasco'), false);
});

test('getSupabaseConfigStatus reports boolean configured flag and missingVars array', () => {
  const status = getSupabaseConfigStatus();
  assert.equal(typeof status.configured, 'boolean');
  assert.ok(Array.isArray(status.missingVars));
});

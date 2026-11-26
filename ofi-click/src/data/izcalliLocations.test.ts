import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_IZCALLI_COLONIAS,
  CUAUTITLAN_IZCALLI_LOCALITIES,
  IZCALLI_COLONIAS_BY_ZONE,
  IZCALLI_MAP_BOUNDS,
  findIzcalliLocality,
} from './izcalliLocations';

test('Cuautitlan Izcalli locality dataset includes comprehensive coverage and all 13 pueblos originarios', () => {
  assert.ok(
    CUAUTITLAN_IZCALLI_LOCALITIES.length >= 90,
    `Expected at least 90 localities, got ${CUAUTITLAN_IZCALLI_LOCALITIES.length}`
  );
  assert.equal(ALL_IZCALLI_COLONIAS.length, CUAUTITLAN_IZCALLI_LOCALITIES.length);

  const pueblos = CUAUTITLAN_IZCALLI_LOCALITIES.filter((l) => l.kind === 'pueblo').map((l) =>
    l.name.toLowerCase()
  );
  const expectedPueblos = [
    'san lorenzo río tenco',
    'san sebastián xhala',
    'san mateo ixtacalco',
    'axotlán',
    'san francisco tepojaco',
    'san martín tepetlixpan',
    'santiago tepalcapa',
    'santa bárbara tlacatecpan',
    'santa maría guadalupe tianguistenco',
    'san juan atlamica',
    'san josé huilango',
    'la aurora',
    'el rosario',
  ];
  for (const pueblo of expectedPueblos) {
    assert.ok(pueblos.includes(pueblo), `Missing pueblo originario: ${pueblo}`);
  }

  // Verify key residential & industrial localities
  for (const keyName of [
    'Centro Urbano',
    'Atlanta',
    'Cumbria',
    'Ensueños',
    'Bosques del Lago',
    'Arcos del Alba',
    'Lomas del Bosque',
    'Cofradía de San Miguel',
    'Infonavit Norte',
    'La Quebrada',
    'Industrial Cuamatla',
    'Parque Industrial Xhala',
  ]) {
    const found = findIzcalliLocality(keyName);
    assert.ok(found, `Expected locality "${keyName}" to resolve`);
    assert.ok(
      found.lat >= IZCALLI_MAP_BOUNDS.minLat && found.lat <= IZCALLI_MAP_BOUNDS.maxLat,
      `Latitude out of Cuautitlán Izcalli bounds for ${keyName}`
    );
    assert.ok(
      found.lng >= IZCALLI_MAP_BOUNDS.minLng && found.lng <= IZCALLI_MAP_BOUNDS.maxLng,
      `Longitude out of Cuautitlán Izcalli bounds for ${keyName}`
    );
  }

  // All 5 zones must be populated
  assert.ok(IZCALLI_COLONIAS_BY_ZONE.Centro.length > 0);
  assert.ok(IZCALLI_COLONIAS_BY_ZONE.Norte.length > 0);
  assert.ok(IZCALLI_COLONIAS_BY_ZONE.Sur.length > 0);
  assert.ok(IZCALLI_COLONIAS_BY_ZONE.Poniente.length > 0);
  assert.ok(IZCALLI_COLONIAS_BY_ZONE.Oriente.length > 0);
});

export type IzcalliLocalityKind =
  | 'colonia'
  | 'fraccionamiento'
  | 'unidad_habitacional'
  | 'pueblo'
  | 'parque_industrial';

export type IzcalliZone = 'Centro' | 'Norte' | 'Sur' | 'Poniente' | 'Oriente';

export interface IzcalliLocality {
  name: string;
  zone: IzcalliZone;
  kind: IzcalliLocalityKind;
  lat: number;
  lng: number;
}

export const IZCALLI_HERO_IMAGE = '/src/assets/images/hero_oficlick_trades_1795707651030.jpg';

export const IZCALLI_MAP_BOUNDS = {
  minLat: 19.595,
  maxLat: 19.728,
  minLng: -99.278,
  maxLng: -99.152,
};

export const IZCALLI_CENTER = { lat: 19.6545, lng: -99.2115 };

/**
 * Catálogo completo territorial de Cuautitlán Izcalli, Estado de México:
 * incluye los 13 pueblos originarios, colonias, fraccionamientos,
 * unidades habitacionales y parques industriales del municipio.
 */
export const CUAUTITLAN_IZCALLI_LOCALITIES: IzcalliLocality[] = [
  // Zona Centro
  { name: 'Centro Urbano', zone: 'Centro', kind: 'colonia', lat: 19.6562, lng: -99.2104 },
  { name: 'Ensueños', zone: 'Centro', kind: 'colonia', lat: 19.6512, lng: -99.2164 },
  { name: 'Cumbria', zone: 'Centro', kind: 'colonia', lat: 19.6442, lng: -99.2191 },
  { name: 'Atlanta 1ra Sección', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6495, lng: -99.2035 },
  { name: 'Atlanta 2da Sección', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6468, lng: -99.2015 },
  { name: 'Atlanta', zone: 'Centro', kind: 'colonia', lat: 19.6485, lng: -99.203 },
  { name: 'Arcos del Alba', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6641, lng: -99.2055 },
  { name: 'Arcos de la Hacienda', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6608, lng: -99.2032 },
  { name: 'Jardines del Alba', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6658, lng: -99.2088 },
  { name: 'Jardines de la Hacienda Norte', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6584, lng: -99.1995 },
  { name: 'Jardines de la Hacienda Sur', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6532, lng: -99.1972 },
  { name: 'Jardines de la Hacienda', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6558, lng: -99.1984 },
  { name: 'Valle de la Hacienda', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6579, lng: -99.1948 },
  { name: 'Bosques de la Hacienda 1ra Sección', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6615, lng: -99.1932 },
  { name: 'Bosques de la Hacienda 2da Sección', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6634, lng: -99.1915 },
  { name: 'Bosques de la Hacienda 3ra Sección', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6649, lng: -99.1895 },
  { name: 'Villas de la Hacienda', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6596, lng: -99.1904 },
  { name: 'Parque Espejo de los Lirios', zone: 'Centro', kind: 'colonia', lat: 19.6548, lng: -99.2148 },
  { name: 'Infonavit Centro', zone: 'Centro', kind: 'unidad_habitacional', lat: 19.6574, lng: -99.2072 },
  { name: 'Infonavit Sur (Niños Héroes)', zone: 'Centro', kind: 'unidad_habitacional', lat: 19.6448, lng: -99.2089 },
  { name: 'Unidad Habitacional Niños Héroes', zone: 'Centro', kind: 'unidad_habitacional', lat: 19.6458, lng: -99.2102 },
  { name: 'Unidad Habitacional México 68', zone: 'Centro', kind: 'unidad_habitacional', lat: 19.6476, lng: -99.2134 },
  { name: 'Rincón Colonial', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6502, lng: -99.2062 },
  { name: 'Rinconada Cuautitlán', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6515, lng: -99.2008 },
  { name: 'Los Pájaros', zone: 'Centro', kind: 'colonia', lat: 19.6488, lng: -99.2225 },
  { name: 'La Perla', zone: 'Centro', kind: 'colonia', lat: 19.6494, lng: -99.2248 },
  { name: 'Santa Rosa de Lima', zone: 'Centro', kind: 'colonia', lat: 19.6572, lng: -99.2194 },
  { name: 'Mirador Santa Rosa', zone: 'Centro', kind: 'colonia', lat: 19.6592, lng: -99.2212 },
  { name: 'La Piedad', zone: 'Centro', kind: 'colonia', lat: 19.6601, lng: -99.2165 },
  { name: 'Las Ánimas', zone: 'Centro', kind: 'colonia', lat: 19.6619, lng: -99.2139 },
  { name: 'Sección Parques', zone: 'Centro', kind: 'colonia', lat: 19.6524, lng: -99.2098 },
  { name: 'Paseos de Izcalli', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6435, lng: -99.2145 },
  { name: 'Urbi Quinta Montecarlo', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6416, lng: -99.2106 },
  { name: 'Residencial La Luz', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6462, lng: -99.1965 },
  { name: 'La Aurora', zone: 'Centro', kind: 'pueblo', lat: 19.6412, lng: -99.2215 },

  // Zona Norte (Infonavit Norte, Cofradía, Xhala, San Lorenzo Río Tenco, San Sebastián)
  { name: 'Infonavit Norte 1ra Sección', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6712, lng: -99.2185 },
  { name: 'Infonavit Norte 2da Sección', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6742, lng: -99.2155 },
  { name: 'Infonavit Norte', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6725, lng: -99.217 },
  { name: 'Cofradía de San Miguel I', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6805, lng: -99.2184 },
  { name: 'Cofradía de San Miguel II', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6832, lng: -99.2158 },
  { name: 'Cofradía de San Miguel III', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6858, lng: -99.2125 },
  { name: 'Cofradía de San Miguel IV', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6881, lng: -99.2098 },
  { name: 'Cofradía de San Miguel', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.684, lng: -99.214 },
  { name: 'Claustros de San Miguel', zone: 'Norte', kind: 'fraccionamiento', lat: 19.6898, lng: -99.2142 },
  { name: 'Ex Hacienda de San Miguel', zone: 'Norte', kind: 'fraccionamiento', lat: 19.6788, lng: -99.2088 },
  { name: 'Unidad Habitacional Campo Uno', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6756, lng: -99.2225 },
  { name: 'Campo Uno', zone: 'Norte', kind: 'colonia', lat: 19.6752, lng: -99.2215 },
  { name: 'San Lorenzo Río Tenco', zone: 'Norte', kind: 'pueblo', lat: 19.6982, lng: -99.2045 },
  { name: 'San Sebastián Xhala', zone: 'Norte', kind: 'pueblo', lat: 19.7085, lng: -99.1885 },
  { name: 'Parque Industrial Xhala', zone: 'Norte', kind: 'parque_industrial', lat: 19.7042, lng: -99.1848 },
  { name: 'Santa Bárbara Tlacatecpan', zone: 'Norte', kind: 'pueblo', lat: 19.6924, lng: -99.1932 },
  { name: 'San Juan Atlamica', zone: 'Norte', kind: 'pueblo', lat: 19.6824, lng: -99.1958 },
  { name: 'Unidad Habitacional Fidel Velázquez', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6768, lng: -99.2045 },
  { name: 'Unidad Habitacional Generalísimo José María Morelos y Pavón (Fovissste)', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6718, lng: -99.2095 },
  { name: 'Unidad Habitacional CTM', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6694, lng: -99.2118 },
  { name: 'Unidad Habitacional Consorcio', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6736, lng: -99.2248 },
  { name: 'Bosques de Morelos', zone: 'Norte', kind: 'colonia', lat: 19.6778, lng: -99.2286 },
  { name: 'Prados de Cuautitlán', zone: 'Norte', kind: 'colonia', lat: 19.6845, lng: -99.2265 },
  { name: 'Villas del Lago', zone: 'Norte', kind: 'fraccionamiento', lat: 19.6698, lng: -99.2245 },
  { name: 'Santa María Guadalupe Las Torres 1ra Sección', zone: 'Norte', kind: 'colonia', lat: 19.6675, lng: -99.2012 },
  { name: 'Santa María Guadalupe Las Torres 2da Sección', zone: 'Norte', kind: 'colonia', lat: 19.6692, lng: -99.1984 },
  { name: 'San Isidro', zone: 'Norte', kind: 'colonia', lat: 19.6765, lng: -99.1965 },
  { name: 'El Socorro', zone: 'Norte', kind: 'colonia', lat: 19.6905, lng: -99.2015 },
  { name: 'San Pablo de los Gallos', zone: 'Norte', kind: 'colonia', lat: 19.6968, lng: -99.2135 },
  { name: 'Joyas de Cuautitlán', zone: 'Norte', kind: 'fraccionamiento', lat: 19.6994, lng: -99.1972 },

  // Zona Poniente (Bosques del Lago, Lago de Guadalupe, Axotlán, Tepojaco, Huilango, El Rosario)
  { name: 'Bosques del Lago', zone: 'Poniente', kind: 'fraccionamiento', lat: 19.6295, lng: -99.2421 },
  { name: 'Colinas del Lago', zone: 'Poniente', kind: 'fraccionamiento', lat: 19.6348, lng: -99.2368 },
  { name: 'Lago de Guadalupe', zone: 'Poniente', kind: 'colonia', lat: 19.6245, lng: -99.2535 },
  { name: 'Granjas Lomas de Guadalupe', zone: 'Poniente', kind: 'colonia', lat: 19.6312, lng: -99.2598 },
  { name: 'Lomas del Bosque', zone: 'Poniente', kind: 'fraccionamiento', lat: 19.6382, lng: -99.2475 },
  { name: 'Axotlán', zone: 'Poniente', kind: 'pueblo', lat: 19.6642, lng: -99.2365 },
  { name: 'El Rosario', zone: 'Poniente', kind: 'pueblo', lat: 19.6615, lng: -99.2485 },
  { name: 'San José Huilango', zone: 'Poniente', kind: 'pueblo', lat: 19.6715, lng: -99.2595 },
  { name: 'San Francisco Tepojaco', zone: 'Poniente', kind: 'pueblo', lat: 19.6498, lng: -99.2555 },
  { name: 'Unidad Habitacional Tepojaco', zone: 'Poniente', kind: 'unidad_habitacional', lat: 19.6462, lng: -99.2482 },
  { name: 'Luis Echeverría', zone: 'Poniente', kind: 'colonia', lat: 19.6435, lng: -99.2315 },
  { name: 'Plan de Guadalupe', zone: 'Poniente', kind: 'colonia', lat: 19.6402, lng: -99.2355 },
  { name: 'Valle Escondido', zone: 'Poniente', kind: 'colonia', lat: 19.6365, lng: -99.2285 },
  { name: 'Tres de Mayo', zone: 'Poniente', kind: 'colonia', lat: 19.6448, lng: -99.2415 },
  { name: 'Los Ailes', zone: 'Poniente', kind: 'colonia', lat: 19.6388, lng: -99.2562 },
  { name: 'La Presita', zone: 'Poniente', kind: 'colonia', lat: 19.6422, lng: -99.2632 },
  { name: 'Loma Bonita', zone: 'Poniente', kind: 'colonia', lat: 19.6542, lng: -99.2345 },
  { name: 'Francisco Villa', zone: 'Poniente', kind: 'colonia', lat: 19.6578, lng: -99.2422 },
  { name: 'Vista Hermosa', zone: 'Poniente', kind: 'colonia', lat: 19.6685, lng: -99.2405 },
  { name: 'San Antonio', zone: 'Poniente', kind: 'colonia', lat: 19.6525, lng: -99.2275 },

  // Zona Sur (La Quebrada, San Martín Tepetlixpan, Lomas de Cuautitlán, Hacienda del Parque)
  { name: 'La Quebrada Centro', zone: 'Sur', kind: 'colonia', lat: 19.6152, lng: -99.2118 },
  { name: 'La Quebrada Ampliación', zone: 'Sur', kind: 'colonia', lat: 19.6115, lng: -99.2155 },
  { name: 'La Quebrada', zone: 'Sur', kind: 'colonia', lat: 19.6138, lng: -99.2135 },
  { name: 'San Martín Tepetlixpan', zone: 'Sur', kind: 'pueblo', lat: 19.6228, lng: -99.2215 },
  { name: 'Lomas de Cuautitlán', zone: 'Sur', kind: 'colonia', lat: 19.6185, lng: -99.2295 },
  { name: 'Hacienda del Parque 1ra Sección', zone: 'Sur', kind: 'fraccionamiento', lat: 19.6112, lng: -99.1985 },
  { name: 'Hacienda del Parque 2da Sección', zone: 'Sur', kind: 'fraccionamiento', lat: 19.6075, lng: -99.2015 },
  { name: 'Valle de las Flores', zone: 'Sur', kind: 'colonia', lat: 19.6275, lng: -99.2065 },
  { name: 'Unidad Adolfo López Mateos', zone: 'Sur', kind: 'unidad_habitacional', lat: 19.6315, lng: -99.2125 },
  { name: 'Unidad Habitacional Bacardí', zone: 'Sur', kind: 'unidad_habitacional', lat: 19.6168, lng: -99.1912 },
  { name: 'Unidad Habitacional Ferrocarrilera', zone: 'Sur', kind: 'unidad_habitacional', lat: 19.6245, lng: -99.1945 },
  { name: 'Nueva Santa María', zone: 'Sur', kind: 'colonia', lat: 19.6338, lng: -99.2028 },
  { name: 'Parque Industrial San Martín Obispo', zone: 'Sur', kind: 'parque_industrial', lat: 19.6095, lng: -99.2235 },
  { name: 'Parque Industrial La Quebrada', zone: 'Sur', kind: 'parque_industrial', lat: 19.6042, lng: -99.2078 },

  // Zona Oriente (Tepalcapa, Cuamatla, San Mateo Ixtacalco, La Luz, Tres Ríos)
  { name: 'Santiago Tepalcapa', zone: 'Oriente', kind: 'pueblo', lat: 19.6392, lng: -99.1932 },
  { name: 'Tepalcapa', zone: 'Oriente', kind: 'colonia', lat: 19.6408, lng: -99.1915 },
  { name: 'Industrial Cuamatla', zone: 'Oriente', kind: 'parque_industrial', lat: 19.6612, lng: -99.1815 },
  { name: 'Parque Industrial La Luz', zone: 'Oriente', kind: 'parque_industrial', lat: 19.6475, lng: -99.1795 },
  { name: 'Parque Industrial Tres Ríos', zone: 'Oriente', kind: 'parque_industrial', lat: 19.6535, lng: -99.1745 },
  { name: 'San Mateo Ixtacalco', zone: 'Oriente', kind: 'pueblo', lat: 19.6875, lng: -99.1665 },
  { name: 'Ejido de San Mateo Ixtacalco', zone: 'Oriente', kind: 'colonia', lat: 19.6825, lng: -99.1725 },
  { name: 'Santa María Guadalupe Tianguistenco', zone: 'Oriente', kind: 'pueblo', lat: 19.6712, lng: -99.1775 },
  { name: 'Arboledas de Cuautitlán', zone: 'Oriente', kind: 'fraccionamiento', lat: 19.6442, lng: -99.1845 },
];

export const ALL_IZCALLI_COLONIAS: string[] = Array.from(
  new Set(CUAUTITLAN_IZCALLI_LOCALITIES.map((l) => l.name))
).sort((a, b) => a.localeCompare(b, 'es'));

export const IZCALLI_COLONIAS_BY_ZONE: Record<IzcalliZone, IzcalliLocality[]> = {
  Centro: CUAUTITLAN_IZCALLI_LOCALITIES.filter((l) => l.zone === 'Centro'),
  Norte: CUAUTITLAN_IZCALLI_LOCALITIES.filter((l) => l.zone === 'Norte'),
  Sur: CUAUTITLAN_IZCALLI_LOCALITIES.filter((l) => l.zone === 'Sur'),
  Poniente: CUAUTITLAN_IZCALLI_LOCALITIES.filter((l) => l.zone === 'Poniente'),
  Oriente: CUAUTITLAN_IZCALLI_LOCALITIES.filter((l) => l.zone === 'Oriente'),
};

export function findIzcalliLocality(name: string): IzcalliLocality | undefined {
  const norm = name.trim().toLowerCase();
  if (!norm) return undefined;
  return (
    CUAUTITLAN_IZCALLI_LOCALITIES.find((l) => l.name.toLowerCase() === norm) ||
    CUAUTITLAN_IZCALLI_LOCALITIES.find((l) => l.name.toLowerCase().includes(norm))
  );
}

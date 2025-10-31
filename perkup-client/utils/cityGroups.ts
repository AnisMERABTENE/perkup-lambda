export interface CityGroup {
  key: string;
  label: string;
  cities: string[];
}

const normalize = (city: string) =>
  city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const CITY_GROUPS: CityGroup[] = [
  {
    key: 'paris_idf',
    label: 'Paris & Île-de-France',
    cities: [
      'paris',
      'boulogne-billancourt',
      'saint-denis',
      'argenteuil',
      'montreuil',
      'nanterre',
      'creteil',
      'versailles',
      'courbevoie',
      'vitry-sur-seine',
      'colombes',
      'asnieres-sur-seine',
      'aulnay-sous-bois',
      'rueil-malmaison',
      'aubervilliers',
      'drancy',
      'noisy-le-grand',
      'evry',
      'issy-les-moulineaux',
      'levallois-perret',
      'clichy',
      'antony',
      'villeneuve-saint-georges',
      'sarcelles',
      'champigny-sur-marne',
      'chelles',
      'saint-maur-des-fosses',
      'melun',
      'meaux',
      'savigny-sur-orge',
      'bagneux',
      'fontenay-sous-bois',
      'saint-ouen',
      'bondy',
      'massys',
      'villiers-sur-marne',
      'neuilly-sur-seine',
      'herblay-sur-seine',
      'herblay',
      'herbley 95220'
    ]
  },
  {
    key: 'marseille',
    label: 'Marseille & Provence',
    cities: [
      'marseille',
      'aix-en-provence',
      'aubagne',
      'vitrolles',
      'martigues',
      'salon-de-provence',
      'istres',
      'marignane',
      'fos-sur-mer'
    ]
  },
  {
    key: 'lille',
    label: 'Lille & Hauts-de-France',
    cities: [
      'lille',
      'roubaix',
      'tourcoing',
      'villeneuve-d\'ascq',
      'douai',
      'arras',
      'calais',
      'lens'
    ]
  },
  {
    key: 'lyon',
    label: 'Lyon & Rhône-Alpes',
    cities: [
      'lyon',
      'villeurbanne',
      'vaulx-en-velin',
      'caluire-et-cuire',
      'venissieux',
      'bron',
      'saint-priest'
    ]
  },
  {
    key: 'clermont',
    label: 'Clermont-Ferrand & Auvergne',
    cities: [
      'clermont-ferrand',
      'issoire',
      'riom',
      'cournon-d\'auvergne',
      'chamalieres'
    ]
  },
  {
    key: 'bordeaux',
    label: 'Bordeaux & Nouvelle-Aquitaine',
    cities: [
      'bordeaux',
      'merignac',
      'pessac',
      'talence',
      'begles',
      'le bouscat'
    ]
  },
  {
    key: 'toulouse',
    label: 'Toulouse & Occitanie',
    cities: [
      'toulouse',
      'blagnac',
      'colomiers',
      'tournefeuille',
      'muret'
    ]
  }
];

export interface CityGroupOption {
  key: string;
  label: string;
  cities: string[];
  count: number;
}

/**
 * Regroupe une liste de villes selon les groupes prédéfinis.
 * Retourne uniquement les groupes correspondant à au moins une ville fournie.
 */
export const buildCityGroupsFromList = (cities: string[]): CityGroupOption[] => {
  if (!cities || cities.length === 0) {
    return [];
  }

  const normalized = cities
    .filter(Boolean)
    .map((city) => ({
      original: city,
      normalized: normalize(city)
    }));

  const groupCount: Record<string, { label: string; cities: Set<string>; total: number }> = {};
  const unmatchedCities = new Set<string>();
  let unmatchedTotal = 0;

  normalized.forEach(({ original, normalized: normCity }) => {
    const matchingGroup = CITY_GROUPS.find((group) =>
      group.cities.some((c) => normalize(c) === normCity)
    );

    if (matchingGroup) {
      if (!groupCount[matchingGroup.key]) {
        groupCount[matchingGroup.key] = {
          label: matchingGroup.label,
          cities: new Set<string>(),
          total: 0
        };
      }
      groupCount[matchingGroup.key].cities.add(original);
      groupCount[matchingGroup.key].total += 1;
    } else {
      unmatchedCities.add(original);
      unmatchedTotal += 1;
    }
  });

  const options = Object.entries(groupCount).map(([key, value]) => ({
    key,
    label: value.label,
    cities: Array.from(value.cities),
    count: value.total
  }));

  if (unmatchedTotal > 0) {
    options.push({
      key: 'other',
      label: 'Autres villes',
      cities: Array.from(unmatchedCities),
      count: unmatchedTotal
    });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
};

export const getCityGroupByKey = (key: string): CityGroup | undefined =>
  CITY_GROUPS.find((group) => group.key === key);

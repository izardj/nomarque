import type { CardEffect, CardTrigger } from '@nomarque/data';
import { describe, expect, it } from 'vitest';
import {
  parseBuildings,
  parseCardEffects,
  parseCardTrigger,
  parseCards,
  parseExpeditions,
  parseGods,
  parseHouses,
  parseParameters,
  parseResources,
  parseStartingMap,
  parseStartingStocks,
} from './parse';

describe('parseResources', () => {
  it('maps tiers, regions and import destinations', () => {
    const csv = `ressource,niveau,prix_ref_deben,region
blé,1,1,Moyenne-Égypte
cuivre,Import,8,Sinaï (expédition)
poisson,1,1.2,Partout
`;
    const { resources, labels } = parseResources(csv);

    expect(resources).toEqual([
      {
        id: 'wheat',
        tier: 1,
        referencePrice: 1,
        regions: ['middle_egypt'],
        importFrom: null,
        cereal: true,
      },
      {
        id: 'copper',
        tier: 'import',
        referencePrice: 8,
        regions: [],
        importFrom: 'sinai',
        cereal: false,
      },
      {
        id: 'fish',
        tier: 1,
        referencePrice: 1.2,
        regions: [],
        importFrom: null,
        cereal: false,
      },
    ]);
    expect(labels).toEqual({
      wheat: 'blé',
      copper: 'cuivre',
      fish: 'poisson',
    });
  });
});

describe('parseBuildings', () => {
  it('maps zones, flows, cost, duration and range', () => {
    const csv = `batiment,zone,classe,ouvriers,entree,entree_par_an,sortie,sortie_par_an,cout_deben,duree_h,portee_parcelles,nombre_simu
Boulangerie,Ville,Artisans,3,blé,120,pain,110,60,8,,99
Puits,Ville,Paysans,1,,,,,20,2,1,3
`;
    const { buildings, labels } = parseBuildings(csv);

    expect(buildings).toEqual([
      {
        id: 'bakery',
        kind: 'workshop',
        zones: ['city'],
        workerClass: 'artisan',
        workers: 3,
        inputs: [{ resource: 'wheat', perYear: 120 }],
        outputs: [{ resource: 'bread', perYear: 110 }],
        cost: { deben: 60 },
        buildHours: 8,
        service: null,
        range: null,
      },
      {
        id: 'well',
        kind: 'service',
        zones: ['city'],
        workerClass: 'peasant',
        workers: 1,
        inputs: [],
        outputs: [],
        cost: { deben: 20 },
        buildHours: 2,
        service: 'water',
        range: 1,
      },
    ]);
    expect(labels.bakery).toBe('Boulangerie');
    expect(labels.well).toBe('Puits');
  });
});

describe('parseHouses', () => {
  it('merges houses with their needs and expands repeated services', () => {
    const houses = `niveau,nom,habitants,classe,impot_par_hab_an,nombre_simu,services_requis
4,Villa,20,Prêtres,6,0,"Hors MVP : eau, 2 temples, divertissement"
`;
    const needs = `maison,ressource,qte_par_hab_an
Villa,pain,3.5
Villa,poisson,3
`;
    const { houses: parsed, labels } = parseHouses(houses, needs);

    expect(parsed).toEqual([
      {
        id: 'villa',
        level: 4,
        inhabitants: 20,
        workerClass: 'priest',
        taxPerInhabitantPerYear: 6,
        needs: [
          { resource: 'bread', perInhabitantPerYear: 3.5 },
          { resource: 'fish', perInhabitantPerYear: 3 },
        ],
        services: ['water', 'temple', 'temple', 'entertainment'],
        inMvp: false,
      },
    ]);
    expect(labels.villa).toBe('Villa');
  });
});

describe('parseParameters', () => {
  const csv = `parametre,valeur,note
Taux d'activité,0.6,
Multiplicateur crue basse,0.6,
Multiplicateur crue bonne,1,
Multiplicateur crue haute,1.25,
Prix plancher (× prix réf.),0.6,
Prix plafond (× prix réf.),1.6,
Taxe de marché,0.03,
Tribut au pharaon,0.1,
Durée d'une année du Nil (h de jeu),168,
Vitesse du serveur,1,
Rattrapage (multiplicateur),1.5,
Inactivité avant abandon (jours réels),7,
Inscription fermée après l'année,3,
Stockage de base par ressource,200,
Capacité d'un grenier par ressource,400,
Maisons par îlot,3,
Coût d'un îlot de maisons (deben),30,
Durée de construction d'un îlot (h de jeu),4,
Deben de départ,300,
Zones des îlots de maisons,"Ville, Terre noire, Désert",
Faveur des dieux au départ,50,
Faveur des dieux maximale,100,
Baisse de faveur des dieux (par h de jeu),0.25,
Faveur d'un temple actif (par h de jeu et par dieu),0.1,
Seuil de faveur basse,30,
Seuil de faveur très basse,15,
Seuil de bénédiction,70,
Intervalle entre offrandes (h de jeu),24,
Hâpy : multiplicateur de crue basse bénie,0.8,
Osiris : effet sur la récolte,0.1,
Bastet : heures avant montée de niveau (béni),18,
Intervalle de tirage des cartes (h de jeu),8,
Probabilité d'une carte par tirage,0.8,
Cartes en attente au maximum,3,
Délai avant le choix par défaut (h de jeu),24,
Poids d'une carte conditionnelle,3,
Poids d'une carte rare,0.2,
Seuil de faveur royale élevée,50,
Faveur royale par unité de tribut,0.2,
Faveur royale perdue par unité de tribut manquante,0.5,
Prestige du 1er d'un classement,10,
Prestige du 2e d'un classement,6,
Prestige du 3e d'un classement,3,
Prestige de participation à un classement,1,
Probabilité d'une crue basse,0.25,
Probabilité d'une crue haute,0.2,
`;

  it('maps parameter labels, including the nested flood multipliers', () => {
    const parameters = parseParameters(csv);

    expect(parameters.floodMultiplier).toEqual({
      low: 0.6,
      good: 1,
      high: 1.25,
    });
    expect(parameters.yearHours).toBe(168);
    expect(parameters.registrationClosesAfterYear).toBe(3);
    expect(parameters).toMatchObject({
      baseStorage: 200,
      granaryCapacity: 400,
      housesPerBlock: 3,
      houseBlockCost: { deben: 30 },
      houseBlockBuildHours: 4,
      startingDeben: 300,
    });
  });

  it('resolves house zones from comma-separated zone labels', () => {
    expect(parseParameters(csv).houseZones).toEqual([
      'city',
      'black_land',
      'desert',
    ]);
  });

  it('maps the J2 favour and card parameters', () => {
    expect(parseParameters(csv)).toMatchObject({
      godFavorStart: 50,
      godFavorMax: 100,
      godFavorDecayPerHour: 0.25,
      templeFavorPerHour: 0.1,
      godFavorLow: 30,
      godFavorVeryLow: 15,
      godFavorBlessing: 70,
      offeringIntervalHours: 24,
      hapyLowFloodMultiplier: 0.8,
      osirisHarvestShare: 0.1,
      bastetUpgradeHours: 18,
      cardDrawIntervalHours: 8,
      cardDrawChance: 0.8,
      cardMaxPending: 3,
      cardGraceHours: 24,
      cardConditionalWeight: 3,
      cardRareWeight: 0.2,
      royalFavorHigh: 50,
      royalFavorPerTribute: 0.2,
      royalFavorPerMissingTribute: 0.5,
    });
  });
});

describe('parseStartingMap', () => {
  it('sorts slots and resolves zones, buildings and houses', () => {
    const csv = `emplacement,ligne,colonne,zone,contenu
1,0,1,Désert,
0,0,0,Ville,Hutte
2,0,2,Terre noire,Champ de blé
`;
    const slots = parseStartingMap(csv);

    expect(
      slots.map(({ slot, row, col, zone, start }) => [
        slot,
        row,
        col,
        zone,
        start,
      ]),
    ).toEqual([
      [0, 0, 0, 'city', { kind: 'houses', house: 'hut' }],
      [1, 0, 1, 'desert', null],
      [2, 0, 2, 'black_land', { kind: 'building', building: 'farm_wheat' }],
    ]);
  });
});

describe('parseStartingStocks', () => {
  it('maps resource labels to quantities', () => {
    const csv = `ressource,quantite
blé,150
poisson,0
`;
    expect(parseStartingStocks(csv)).toEqual({ wheat: 150, fish: 0 });
  });

  it('fails when a resource appears more than once', () => {
    const csv = `ressource,quantite
blé,150
blé,20
`;
    expect(() => parseStartingStocks(csv)).toThrow(
      /stocks_depart\.csv:3: resource "wheat" appears more than once/,
    );
  });
});

describe('parseExpeditions', () => {
  it('derives safe and fast route ids from the route label', () => {
    const csv = `destination,route,duree_h,cout_deben,rapporte,quantite,risque_perte
Sinaï,"Côtière, sûre",48,120,cuivre,20,0.05
Sinaï,Par le désert,32,120,cuivre,24,0.2
`;
    const { expeditions, routeLabels, destinationLabels } =
      parseExpeditions(csv);

    expect(expeditions).toEqual([
      {
        id: 'sinai_safe',
        destination: 'sinai',
        safe: true,
        durationHours: 48,
        costDeben: 120,
        resource: 'copper',
        quantity: 20,
        lossRisk: 0.05,
      },
      {
        id: 'sinai_fast',
        destination: 'sinai',
        safe: false,
        durationHours: 32,
        costDeben: 120,
        resource: 'copper',
        quantity: 24,
        lossRisk: 0.2,
      },
    ]);
    expect(routeLabels).toEqual({
      sinai_safe: 'Côtière, sûre',
      sinai_fast: 'Par le désert',
    });
    expect(destinationLabels).toEqual({ sinai: 'Sinaï' });
  });
});

describe('parseCards', () => {
  it('keeps only filled choices and maps empty gods to null', () => {
    const csv = `id,titre,declencheur,phase,dieu,texte,choix_a,effet_a,choix_b,effet_b,choix_c,effet_c,defaut
C01,Le chat sacré,Tutoriel (mission 3),Toutes,Bastet,Un chat sacré dort.,Attendre,grenier inaccessible 6 h,L'honorer,poisson -5,,,A
C02,Le scribe,Aléatoire,Toutes,,Un texte.,Agir,rien,,,Dormir,rien,C
`;
    const { cards, labels } = parseCards(csv);

    expect(cards).toEqual([
      {
        id: 'C01',
        triggerRaw: 'Tutoriel (mission 3)',
        trigger: { kind: 'tutorial' },
        phase: 'any',
        god: 'bastet',
        choices: [
          {
            key: 'a',
            effectRaw: 'grenier inaccessible 6 h',
            effects: [
              {
                kind: 'idle',
                target: { kind: 'building', building: 'granary' },
                percent: -100,
                hours: 6,
              },
            ],
          },
          {
            key: 'b',
            effectRaw: 'poisson -5',
            effects: [{ kind: 'resource', resource: 'fish', amount: -5 }],
          },
        ],
        defaultChoice: 'a',
      },
      {
        id: 'C02',
        triggerRaw: 'Aléatoire',
        trigger: { kind: 'random' },
        phase: 'any',
        god: null,
        choices: [
          { key: 'a', effectRaw: 'rien', effects: [] },
          { key: 'c', effectRaw: 'rien', effects: [] },
        ],
        defaultChoice: 'c',
      },
    ]);
    expect(labels.C01).toEqual({
      title: 'Le chat sacré',
      text: 'Un chat sacré dort.',
      choices: {
        a: { label: 'Attendre', effect: 'grenier inaccessible 6 h' },
        b: { label: "L'honorer", effect: 'poisson -5' },
      },
    });
    expect(labels.C02?.choices.b).toBeUndefined();
  });
});

describe('parseCardEffects', () => {
  it.each<[string, string, CardEffect[]]>([
    ['no effect for "rien"', 'rien', []],
    ['no effect for "récolte protégée"', 'récolte protégée', []],
    [
      'a resource amount',
      'blé +30',
      [{ kind: 'resource', resource: 'wheat', amount: 30 }],
    ],
    [
      'a resource share',
      'blé -10 %',
      [{ kind: 'resourceShare', resource: 'wheat', percent: -10 }],
    ],
    [
      'a production until the end of the year',
      "poterie +20 % jusqu'à la fin de l'année",
      [
        {
          kind: 'production',
          resource: 'pottery',
          percent: 20,
          hours: 'year',
          startsAfter: 0,
        },
      ],
    ],
    [
      'a production chained after a duration',
      'pêcherie inactive 6 h, puis poisson +30 % 24 h',
      [
        {
          kind: 'idle',
          target: { kind: 'building', building: 'fishery' },
          percent: -100,
          hours: 6,
        },
        {
          kind: 'production',
          resource: 'fish',
          percent: 30,
          hours: 24,
          startsAfter: 6,
        },
      ],
    ],
    ['a deben amount', 'deben -30', [{ kind: 'deben', amount: -30 }]],
    [
      'a royal favour amount',
      'faveur +20',
      [{ kind: 'royalFavor', amount: 20 }],
    ],
    [
      'a god favour amount',
      'Bastet +10',
      [{ kind: 'godFavor', god: 'bastet', amount: 10 }],
    ],
    [
      'a favour amount for every god',
      'tous les dieux -2',
      [{ kind: 'godFavor', god: 'all', amount: -2 }],
    ],
    [
      'a population amount',
      'scribes -1',
      [{ kind: 'population', workerClass: 'scribe', amount: -1 }],
    ],
    [
      'a workforce percentage with "pendant"',
      'paysans -20 % pendant 24 h',
      [
        {
          kind: 'workforce',
          workerClass: 'peasant',
          change: { percent: -20 },
          hours: 24,
        },
      ],
    ],
    [
      'a workforce percentage without "pendant"',
      'paysans -30 % 24 h',
      [
        {
          kind: 'workforce',
          workerClass: 'peasant',
          change: { percent: -30 },
          hours: 24,
        },
      ],
    ],
    [
      'a workforce count',
      'paysans -10 pendant 48 h',
      [
        {
          kind: 'workforce',
          workerClass: 'peasant',
          change: { count: -10 },
          hours: 48,
        },
      ],
    ],
    [
      'inactive workers',
      'scribes inactifs 12 h',
      [
        {
          kind: 'workforce',
          workerClass: 'scribe',
          change: { percent: -100 },
          hours: 12,
        },
      ],
    ],
    [
      'a production hit on every worker class',
      'production -100 % pendant 6 h',
      [
        {
          kind: 'workforce',
          workerClass: 'all',
          change: { percent: -100 },
          hours: 6,
        },
      ],
    ],
    [
      'idle field workers',
      'ouvriers des champs -50 % 12 h',
      [
        {
          kind: 'idle',
          target: { kind: 'fields' },
          percent: -50,
          hours: 12,
        },
      ],
    ],
    [
      'an idle building',
      'carrière inactive 24 h',
      [
        {
          kind: 'idle',
          target: { kind: 'building', building: 'limestone_quarry' },
          percent: -100,
          hours: 24,
        },
      ],
    ],
    [
      'idle river parcels',
      'parcelles de rive inactives 24 h',
      [
        {
          kind: 'idle',
          target: { kind: 'zone', zone: 'river' },
          percent: -100,
          hours: 24,
        },
      ],
    ],
    [
      'a consumption reduction',
      'conso de blé -20 % 48 h',
      [
        {
          kind: 'consumption',
          resource: 'wheat',
          percent: -20,
          hours: 48,
        },
      ],
    ],
    ['a harvest change', 'récolte -20 %', [{ kind: 'harvest', percent: -20 }]],
    ['a tribute change', 'tribut +5 %', [{ kind: 'tribute', percent: 5 }]],
    [
      'a blocked house upgrade',
      'une maison : montée de niveau bloquée 24 h',
      [{ kind: 'houseUpgrade', mode: 'blocked', hours: 24 }],
    ],
    [
      'a blocked house upgrade without a subject',
      'montée de niveau bloquée 48 h',
      [{ kind: 'houseUpgrade', mode: 'blocked', hours: 48 }],
    ],
    [
      'a fast house upgrade',
      'maisons : montée de niveau accélérée 24 h',
      [{ kind: 'houseUpgrade', mode: 'fast', hours: 24 }],
    ],
    [
      'a flood forecast',
      'prochaine crue révélée 6 h en avance',
      [{ kind: 'floodForecast', hours: 6 }],
    ],
    [
      'a chance effect',
      '50 % : récolte -15 %',
      [
        {
          kind: 'chance',
          probability: 0.5,
          effect: { kind: 'harvest', percent: -15 },
        },
      ],
    ],
  ])('parses %s', (_name, text, expected) => {
    expect(parseCardEffects(text, 'cartes.csv', 2)).toEqual(expected);
  });

  it('keeps the order of the atoms', () => {
    expect(parseCardEffects('blé -30 ; Thot -5', 'cartes.csv', 2)).toEqual([
      { kind: 'resource', resource: 'wheat', amount: -30 },
      { kind: 'godFavor', god: 'thoth', amount: -5 },
    ]);
  });

  it('fails on an unknown atom with the file, the line and the text', () => {
    expect(() => parseCardEffects('Zeus +1', 'cartes.csv', 2)).toThrow(
      /cartes\.csv:2: unknown card effect "Zeus \+1"/,
    );
  });
});

describe('parseCardTrigger', () => {
  it.each<[string, string, CardTrigger]>([
    ['a random card', 'Aléatoire', { kind: 'random' }],
    ['a yearly card', 'Une fois par année', { kind: 'random' }],
    ['a rare card', 'Rare', { kind: 'rare' }],
    ['a tutorial card', 'Tutoriel (mission 3)', { kind: 'tutorial' }],
    [
      'a stock threshold',
      'Stock de blé > 200',
      { kind: 'stockAbove', resource: 'wheat', quantity: 200 },
    ],
    [
      'a low god favour',
      'Faveur de Bastet basse',
      { kind: 'godFavorBelow', god: 'bastet', level: 'low' },
    ],
    [
      'a very low god favour',
      'Faveur de Bastet très basse',
      { kind: 'godFavorBelow', god: 'bastet', level: 'veryLow' },
    ],
    ['a high royal favour', 'Faveur royale élevée', { kind: 'royalFavorHigh' }],
    ['a low flood', 'Crue basse', { kind: 'flood', level: 'low' }],
    ['a good flood', 'Crue bonne', { kind: 'flood', level: 'good' }],
    ['a high flood', 'Crue haute', { kind: 'flood', level: 'high' }],
    ['the start of Akhet', "Début d'Akhet", { kind: 'phaseStart' }],
    [
      'the time before the tribute',
      'Avant le tribut',
      { kind: 'beforeTribute' },
    ],
    [
      'a built building',
      "Champ d'orge construit",
      { kind: 'built', building: 'farm_barley' },
    ],
    [
      'a built building with a feminine form',
      'Carrière construite',
      { kind: 'built', building: 'limestone_quarry' },
    ],
    [
      'a number of houses',
      '3 maisons ou plus',
      { kind: 'housesAtLeast', count: 3 },
    ],
    [
      'busy workers',
      'Paysans occupés à 100 % depuis 48 h',
      { kind: 'busyWorkers', workerClass: 'peasant', hours: 48 },
    ],
    [
      'a price above a factor of the reference price',
      'Prix du pain > prix réf. × 1,4',
      { kind: 'priceAbove', resource: 'bread', factor: 1.4 },
    ],
  ])('parses %s', (_name, text, expected) => {
    expect(parseCardTrigger(text, 'cartes.csv', 2)).toEqual(expected);
  });

  it('fails on an unknown trigger with the file, the line and the text', () => {
    expect(() => parseCardTrigger('Quand il pleut', 'cartes.csv', 2)).toThrow(
      /cartes\.csv:2: unknown card trigger "Quand il pleut"/,
    );
  });
});

describe('parseGods', () => {
  const header =
    'dieu,domaine,offrande_ressource,offrande_quantite,faveur_offrande,note';
  const csv = `${header}
Osiris,Les récoltes,blé,20,10,
Hâpy,La crue,blé,20,10,
Thot,Le savoir,pain,10,10,
Bastet,Le foyer,poisson,10,10,
Sekhmet,La santé,pain,10,10,
`;

  it('returns the gods in contract order', () => {
    expect(parseGods(csv)).toEqual([
      {
        id: 'hapy',
        offering: { resource: 'wheat', quantity: 20 },
        favorPerOffering: 10,
      },
      {
        id: 'osiris',
        offering: { resource: 'wheat', quantity: 20 },
        favorPerOffering: 10,
      },
      {
        id: 'thoth',
        offering: { resource: 'bread', quantity: 10 },
        favorPerOffering: 10,
      },
      {
        id: 'bastet',
        offering: { resource: 'fish', quantity: 10 },
        favorPerOffering: 10,
      },
      {
        id: 'sekhmet',
        offering: { resource: 'bread', quantity: 10 },
        favorPerOffering: 10,
      },
    ]);
  });

  it('fails on an unknown god with the file name', () => {
    const broken = csv.replace('Hâpy,', 'Zeus,');

    expect(() => parseGods(broken)).toThrow(
      /dieux\.csv:3: unknown god label "Zeus"/,
    );
  });

  it('fails when a god is missing', () => {
    const broken = csv.replace('Sekhmet,La santé,pain,10,10,\n', '');

    expect(() => parseGods(broken)).toThrow(
      /dieux\.csv: missing god "sekhmet"/,
    );
  });

  it('fails when an offering quantity is not positive', () => {
    const broken = csv.replace(
      'Osiris,Les récoltes,blé,20,10,',
      'Osiris,Les récoltes,blé,0,10,',
    );

    expect(() => parseGods(broken)).toThrow(
      /dieux\.csv:2: offering quantity must be positive/,
    );
  });
});

describe('unknown labels', () => {
  it('fails with the file, the line and the offending value', () => {
    const csv = `ressource,niveau,prix_ref_deben,region
inconnu,1,1,Partout
`;
    expect(() => parseResources(csv)).toThrow(
      /ressources\.csv:2: unknown resource label "inconnu"/,
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  parseBuildings,
  parseCards,
  parseExpeditions,
  parseHouses,
  parseParameters,
  parseResources,
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
      },
      {
        id: 'copper',
        tier: 'import',
        referencePrice: 8,
        regions: [],
        importFrom: 'sinai',
      },
      {
        id: 'fish',
        tier: 1,
        referencePrice: 1.2,
        regions: [],
        importFrom: null,
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
  it('maps parameter labels, including the nested flood multipliers', () => {
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
`;
    const parameters = parseParameters(csv);

    expect(parameters.floodMultiplier).toEqual({
      low: 0.6,
      good: 1,
      high: 1.25,
    });
    expect(parameters.yearHours).toBe(168);
    expect(parameters.registrationClosesAfterYear).toBe(3);
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
        phase: 'any',
        god: 'bastet',
        choices: [
          { key: 'a', effectRaw: 'grenier inaccessible 6 h' },
          { key: 'b', effectRaw: 'poisson -5' },
        ],
        defaultChoice: 'a',
      },
      {
        id: 'C02',
        triggerRaw: 'Aléatoire',
        phase: 'any',
        god: null,
        choices: [
          { key: 'a', effectRaw: 'rien' },
          { key: 'c', effectRaw: 'rien' },
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

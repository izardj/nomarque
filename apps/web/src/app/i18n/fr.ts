import type {
  GodStandingDto,
  NilePhaseDto,
  NomeActionErrorCode,
} from '@nomarque/contracts';
import type {
  BuildingKind,
  FloodLevel,
  God,
  Region,
  ResourceId,
  Service,
  WorkerClass,
  Zone,
} from '@nomarque/data';

const numberFormat = new Intl.NumberFormat('fr-FR');

/** Every visible string of the app, grouped by screen. */
export const fr = {
  common: {
    loading: 'Méri cherche dans ses papyrus…',
    back: '← Retour',
    logout: 'Se déconnecter',
  },

  login: {
    title: 'Bienvenue au nome',
    intro:
      "Je suis Méri, ta scribe. Donne-moi ton e-mail et je t'envoie un lien magique. Pas de mot de passe : j'ai déjà assez de hiéroglyphes à retenir.",
    emailLabel: 'Ton adresse e-mail',
    submit: 'Recevoir mon lien',
    sending: 'Envoi en cours…',
    sent: "Méri t'a envoyé un lien. Ouvre ta boîte mail et clique dessus : tu seras chez toi. Regarde aussi dans les indésirables, un papyrus s'égare vite.",
    invalidEmail:
      'Cette adresse ne ressemble pas à un e-mail. Vérifie-la : même les scribes se trompent.',
  },

  verify: {
    title: 'Ouverture de la porte',
    checking: 'Méri vérifie ton lien…',
    failedTitle: 'Ce lien ne marche plus',
    missingToken:
      'Il manque quelque chose à ce lien. Recopie-le en entier ou demandes-en un nouveau.',
    retry: 'Recevoir un nouveau lien',
  },

  worlds: {
    title: 'Choisis ton monde',
    intro: 'Chaque monde a son rythme. Choisis celui qui te ressemble.',
    empty: "Aucun monde n'est ouvert pour l'instant. Reviens un peu plus tard.",
    speed: (yearsPerWeek: number): string =>
      yearsPerWeek === 1
        ? '1 année du Nil par semaine'
        : `${numberFormat.format(yearsPerWeek)} années du Nil par semaine`,
    reign: (number: number, status: string): string =>
      `Règne ${number} · ${status}`,
    noReign: 'Aucun règne en cours',
    reignStatus: {
      scheduled: 'à venir',
      running: 'en cours',
      funerals: 'funérailles',
      ended: 'terminé',
    },
    join: 'Rejoindre',
    enter: 'Entrer dans mon nome',
  },

  regions: {
    upper_egypt: {
      label: 'Haute-Égypte',
      blurb: "Du granit et de l'or de Nubie, mais peu de terres à cultiver.",
    },
    middle_egypt: {
      label: 'Moyenne-Égypte',
      blurb: 'Le grenier du pays : tu auras beaucoup de blé.',
    },
    delta: {
      label: 'Delta',
      blurb: 'Du papyrus, du lin et un accès direct à Byblos.',
    },
  } satisfies Record<Region, { label: string; blurb: string }>,

  join: {
    title: 'Fonde ton nome',
    intro:
      "Choisis ta région : elle décide de ce que ton nome produit le mieux. Tu ne pourras pas changer d'avis, alors réfléchis bien.",
    regionLegend: 'Ta région',
    nomeNameLabel: 'Nom du nome',
    nomeNameHint: 'Par exemple : Nome du Faucon.',
    dynastyNameLabel: 'Nom de dynastie',
    dynastyNameHint: "Je t'en propose un. Garde-le ou choisis le tien.",
    submit: 'Fonder mon nome',
    submitting: 'Fondation en cours…',
    regionRequired: 'Choisis une région pour continuer.',
    nomeNameInvalid: 'Donne un nom à ton nome (2 à 40 caractères).',
    dynastyNameInvalid: 'Donne un nom à ta dynastie (2 à 40 caractères).',
    dynastyProposals: [
      'Maison des Séthides',
      'Maison des Ramessides',
      'Maison des Thoutmosides',
      'Maison des Ahmosides',
      'Maison des Amenemhat',
      'Maison des Montouhotep',
      'Maison des Sobekhotep',
      'Maison des Ptahhotep',
    ],
  },

  nome: {
    deben: (amount: number): string =>
      `${numberFormat.format(Math.round(amount))} deben`,
    favor: (amount: number): string =>
      `Faveur ${numberFormat.format(Math.round(amount))}`,
    dynastyAndRegion: (dynasty: string, region: string): string =>
      `${dynasty} · ${region}`,
  },

  shell: {
    navLabel: 'Écrans du nome',
    tabs: {
      report: 'Rapport',
      cards: 'Cartes',
      workers: 'Ouvriers',
      city: 'Cité',
      gods: 'Dieux',
      market: 'Marché',
      nile: 'Nil',
    },
    pendingCards: (count: number): string =>
      `${numberFormat.format(count)} ${count < 2 ? 'carte en attente' : 'cartes en attente'}`,
    soon: 'bientôt',
    soonLabel: (tab: string): string => `${tab}, bientôt disponible`,
    currentPhase: (phase: string): string => `Phase actuelle : ${phase}`,
    reignOver: 'Le règne est terminé.',
    reignOverHint: 'Le classement est figé : plus aucune action possible.',
  },

  phases: {
    akhet: 'Akhet',
    peret: 'Peret',
    shemu: 'Shemu',
  } satisfies Record<NilePhaseDto, string>,

  /** Grammatical gender of each resource, for agreements ("perdue"). */
  resourceGender: {
    wheat: 'm',
    barley: 'f',
    flax: 'm',
    papyrus: 'm',
    fish: 'm',
    clay: 'f',
    limestone: 'm',
    bricks: 'f',
    bread: 'm',
    beer: 'f',
    pottery: 'f',
    linen: 'm',
    scrolls: 'm',
    copper: 'm',
    cedar: 'm',
    gold: 'm',
    incense: 'm',
  } satisfies Record<ResourceId, 'm' | 'f'>,

  report: {
    title: 'Rapport de Méri',
    away: (hours: number): string =>
      `Pendant ton absence · ${numberFormat.format(hours)} ${hours < 2 ? 'heure' : 'heures'}`,
    emptyTitle: 'Rien de neuf depuis ta dernière visite',
    emptyText:
      "Les ouvriers travaillent, les greniers dorment et le Nil suit son cours. Reviens tout à l'heure.",
    ack: "C'est noté",
    taxes: "deben d'impôts",
    harvested: 'récolte',
    tribute: 'tribut',
    consumedWord: 'consommé',
    lost: (amount: string, label: string, participle: string): string =>
      `Grenier plein : ${amount} ${label} ${participle}.`,
    lostWord: 'perdu',
    lostHint: 'Pense à construire un grenier.',
    tributeMissing: (amount: string, label: string): string =>
      `Tribut incomplet : il a manqué ${amount} ${label}.`,
    shortage: (amount: string, label: string): string =>
      `Besoin non couvert : il a manqué ${amount} ${label}.`,
    completed: (name: string): string => `Chantier terminé : ${name}.`,
    houseUp: (name: string, level: number): string =>
      `Maisons montées au niveau ${level} : ${name}.`,
    houseDown: (name: string, level: number): string =>
      `Maisons descendues au niveau ${level} : ${name}.`,
    houseWarning: (name: string): string =>
      `Attention : ${name} manque d'un service et risque de redescendre.`,
    unknownParcel: 'une parcelle',
    royalFavor: 'faveur royale',
    cardDealt: (title: string): string => `Nouvelle carte : ${title}.`,
    cardDefaulted: (title: string, choice: string): string =>
      `Sans réponse de ta part, Méri a tranché pour « ${title} » : ${choice}.`,
    cardsLink: (count: number): string =>
      `${numberFormat.format(count)} ${count < 2 ? 'décision attend' : 'décisions attendent'} ta réponse`,
    cardsLinkAction: 'Voir les cartes',
  },

  cards: {
    back: '‹ Rapport',
    position: (phase: string, index: number, total: number): string =>
      `${phase} · carte ${numberFormat.format(index)} sur ${numberFormat.format(total)}`,
    emptyTitle: 'Aucune décision en attente.',
    emptyText: "Méri te prévient dès qu'une carte se présente.",
    emptyLink: 'Retour au rapport',
    unaffordable: 'Pas de quoi payer',
    defaultIn: (remaining: string, choice: string): string =>
      `Sans réponse dans ${remaining}, Méri choisira « ${choice} ».`,
    defaultNow: (choice: string): string =>
      `Méri va choisir « ${choice} » d'un instant à l'autre.`,
  },

  nile: {
    title: 'Le Nil',
    yearAndPhase: (year: number, phase: string): string =>
      `Année ${numberFormat.format(year)} du règne · ${phase}`,
    flood: (level: string): string => `Crue de cette année : ${level}`,
    nextFlood: (level: string): string =>
      `Crue annoncée pour l'an prochain : ${level}`,
    floods: {
      low: 'basse',
      good: 'bonne',
      high: 'haute',
    } satisfies Record<FloodLevel, string>,
    cropsLocked: "Cultures verrouillées jusqu'à la prochaine crue.",
    cropsOpen: (remaining: string): string =>
      `Cultures modifiables encore ${remaining}.`,
    cropsOpenSoon: 'Cultures modifiables, plus pour longtemps.',
  },

  gods: {
    title: 'Les dieux',
    listLabel: 'Faveur des dieux',
    domains: {
      hapy: 'La crue',
      osiris: 'Les récoltes',
      thoth: 'Le savoir',
      bastet: 'Le foyer',
      sekhmet: 'La santé',
    } satisfies Record<God, string>,
    standings: {
      blessing: 'Bénédiction',
      neutral: 'Neutre',
      low: 'Négligé',
      veryLow: 'Courroucé',
    } satisfies Record<GodStandingDto, string>,
    gauge: (name: string): string => `Faveur de ${name}`,
    gaugeValue: (value: number, max: number): string =>
      `${numberFormat.format(Math.round(value))} sur ${numberFormat.format(max)}`,
    thresholds: (low: number, blessing: number): string =>
      `Négligé sous ${numberFormat.format(low)} · Bénédiction dès ${numberFormat.format(blessing)}`,
    offer: (quantity: number, resource: string, favor: number): string =>
      `Offrir ${numberFormat.format(quantity)} ${resource} (+${numberFormat.format(favor)})`,
    offerFor: (label: string, god: string): string => `${label}, ${god}`,
    offeringIn: (remaining: string): string =>
      `Prochaine offrande dans ${remaining}`,
    offeringSoon: 'Prochaine offrande dans un instant',
    notEnough: (resource: string): string => `Pas assez de ${resource}`,
    modifiersTitle: 'Effets en cours',
    modifiersEmpty: 'Aucun effet en cours.',
    modifierEnds: (remaining: string): string => `encore ${remaining}`,
    modifierEndsSoon: 'bientôt fini',
    modifierPending: 'à venir',
    modifierFallback: 'Effet de carte',
    modifier: {
      workforce: (workerClass: string, change: string): string =>
        `${workerClass} ${change}`,
      workforceAll: (change: string): string => `Production ${change}`,
      stopped: (who: string): string => `${who} à l'arrêt`,
      idle: (who: string, change: string): string => `${who} ${change}`,
      fields: 'Ouvriers des champs',
      production: (resource: string, change: string): string =>
        `Production de ${resource} ${change}`,
      consumption: (resource: string, change: string): string =>
        `Consommation de ${resource} ${change}`,
      housesBlocked: 'Montée de niveau des maisons bloquée',
      housesFast: 'Montée de niveau des maisons accélérée',
    },
    names: {
      hapy: 'Hâpy',
      osiris: 'Osiris',
      thoth: 'Thot',
      bastet: 'Bastet',
      sekhmet: 'Sekhmet',
    } satisfies Record<God, string>,
  },

  zones: {
    desert: 'Désert',
    city: 'Ville',
    black_land: 'Terre noire',
    river: 'Fleuve',
  } satisfies Record<Zone, string>,

  services: {
    water: 'eau',
    temple: 'culte',
    school: 'école',
    market: 'marché',
    entertainment: 'divertissements',
  } satisfies Record<Service, string>,

  /** Worker classes: singular, then plural. */
  workerClasses: {
    peasant: { one: 'paysan', many: 'paysans', title: 'Paysans' },
    artisan: { one: 'artisan', many: 'artisans', title: 'Artisans' },
    scribe: { one: 'scribe', many: 'scribes', title: 'Scribes' },
    priest: { one: 'prêtre', many: 'prêtres', title: 'Prêtres' },
  } satisfies Record<WorkerClass, { one: string; many: string; title: string }>,

  workers: {
    title: 'Ouvriers',
    classesLabel: 'Ouvriers par classe',
    listLabel: 'Bâtiments en service',
    classCount: (assigned: number, available: number): string =>
      `${numberFormat.format(assigned)} / ${numberFormat.format(available)}`,
    free: (count: number): string =>
      `${numberFormat.format(count)} ${count < 2 ? 'libre' : 'libres'}`,
    short: (count: number): string => `${numberFormat.format(count)} en manque`,
    meta: (
      workerClass: string,
      required: number,
      row: number,
      col: number,
    ): string =>
      `${workerClass} · ${numberFormat.format(required)} requis · ligne ${row}, colonne ${col}`,
    harvest: (amount: string, label: string): string =>
      `≈ ${amount} ${label} à la récolte`,
    perYear: (amount: string, label: string): string =>
      `${amount} ${label} / an`,
    underStaffed: (workers: number, required: number, loss: number): string =>
      `${numberFormat.format(workers)} / ${numberFormat.format(required)} · production −${numberFormat.format(loss)} %`,
    remove: (workerClass: string, place: string): string =>
      `Retirer un ${workerClass} : ${place}`,
    add: (workerClass: string, place: string): string =>
      `Ajouter un ${workerClass} : ${place}`,
    place: (building: string, row: number, col: number): string =>
      `${building}, ligne ${row}, colonne ${col}`,
    empty: "Aucun bâtiment n'est en service pour l'instant.",
    emptyLink: 'Construire dans ta cité',
  },

  city: {
    title: 'Ta cité',
    gridLabel: 'Parcelles de ta cité',
    parcels: (built: number, total: number): string =>
      `${numberFormat.format(built)} ${built < 2 ? 'parcelle' : 'parcelles'} sur ${numberFormat.format(total)}`,
    build: '+ Construire',
    emptyTileLabel: (zone: string): string =>
      `Parcelle vide, ${zone} : construire`,
    houses: (count: number, level: number): string =>
      `×${count} · niv. ${level}`,
    site: (remaining: string): string => `Chantier · prêt dans ${remaining}`,
    siteSoon: 'Chantier · bientôt prêt',
    inRange: 'dans la portée',
    legendRange: (building: string): string => `Portée : ${building}`,
    kinds: {
      field: 'récolte',
      raw: 'production',
      workshop: 'atelier',
      service: 'service',
      storage: 'stockage',
      port: 'expéditions',
    } satisfies Record<BuildingKind, string>,
    close: 'Fermer',
    zone: (zone: string): string => `Terrain : ${zone}`,
    workers: (
      assigned: number,
      required: number,
      workerClass: string,
    ): string => `${assigned} / ${required} ${workerClass}`,
    produces: (resources: string): string => `Produit : ${resources}.`,
    storage: 'Augmente la place dans tes greniers.',
    port: 'Ouvre les expéditions et le commerce.',
    service: (service: string, range: number): string =>
      `Service : ${service}. Il couvre les parcelles à ${numberFormat.format(range)} ${range < 2 ? 'case' : 'cases'} ou moins, diagonales comprises.`,
    manageWorkers: 'Gérer les ouvriers',
    siteDetail: (remaining: string): string =>
      `En chantier, prêt dans ${remaining}.`,
    siteDetailSoon: 'En chantier, bientôt prêt.',
    houseLevel: (level: number, house: string): string =>
      `Niveau ${level} · ${house}`,
    emptyTitle: 'Parcelle vide',
    choose: 'Que veux-tu construire ici ?',
    nothingAllowed: 'Rien ne peut être construit sur ce terrain.',
    houseBlock: 'Îlot de maisons',
    houseBlockDetail: (count: number, house: string): string =>
      `${count} ${house}`,
    cost: (deben: number, hours: number): string =>
      `${numberFormat.format(deben)} deben · ${numberFormat.format(hours)} h`,
    notEnoughDeben: 'Pas assez de deben',
    confirm: 'Construire',
    confirmChoice: (name: string): string => `Construire : ${name}`,
    cropTitle: 'Culture',
    cropHint: 'Tu peux changer de culture tant que dure la crue.',
    cropCurrent: 'actuelle',
    cropLocked:
      'Les semailles sont faites : la culture ne change plus avant la prochaine crue.',
  },

  errors: {
    network_error:
      'Impossible de joindre le serveur. Vérifie ta connexion et réessaie.',
    mail_unavailable: "L'e-mail n'a pas pu partir. Réessaie dans un instant.",
    invalid_token:
      "Ce lien est périmé ou déjà utilisé. Demandes-en un nouveau, c'est gratuit.",
    dynasty_name_required: 'Choisis un nom de dynastie pour fonder ton nome.',
    already_joined: 'Tu as déjà un nome dans ce monde.',
    no_active_reign:
      "Aucun règne n'est en cours dans ce monde. Reviens bientôt.",
    reign_closing:
      'Le règne se termine. Les inscriptions rouvriront avec le suivant.',
    unknown: 'Quelque chose a coincé. Réessaie dans un instant.',
    unknown_parcel: "Cette parcelle n'existe pas dans ton nome.",
    parcel_not_empty:
      'Cette parcelle est déjà occupée. Choisis une parcelle vide.',
    zone_not_allowed: "Ce terrain n'accepte pas cette construction.",
    not_enough_deben:
      "Il te manque des deben pour cette construction. Ta bourse n'est pas encore assez ronde.",
    no_building: "Il n'y a pas de bâtiment sur cette parcelle.",
    invalid_workers: "Ce nombre d'ouvriers ne convient pas à ce bâtiment.",
    not_a_field: "Cette parcelle n'est pas un champ.",
    crops_locked:
      "Les semailles sont faites : on ne change plus de culture avant l'Akhet.",
    offering_too_soon:
      'Les dieux ont déjà reçu ton offrande. Laisse-les digérer.',
    not_enough_resources: 'Il te manque de quoi payer cette offrande.',
    unknown_card: "Cette carte n'est plus en attente.",
    unknown_choice: 'Cette carte ne propose pas ce choix.',
    cannot_afford: "Tu n'as pas de quoi payer ce choix.",
    reign_over: 'Le règne est terminé : plus rien ne peut changer.',
  } satisfies Record<NomeActionErrorCode, string> & Record<string, string>,
} as const;

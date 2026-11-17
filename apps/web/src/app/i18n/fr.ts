import type { NilePhaseDto, NomeActionErrorCode } from '@nomarque/contracts';
import type { Region, ResourceId } from '@nomarque/data';

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
      city: 'Cité',
      workers: 'Ouvriers',
      market: 'Marché',
      nile: 'Nil',
    },
    soon: 'bientôt',
    soonLabel: (tab: string): string => `${tab}, bientôt disponible`,
    currentPhase: (phase: string): string => `Phase actuelle : ${phase}`,
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
  } satisfies Record<NomeActionErrorCode, string> & Record<string, string>,
} as const;

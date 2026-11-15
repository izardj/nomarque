// French texts of the e-mails sent by the API.

export function magicLinkMail(
  link: string,
  ttlMinutes: number,
): { subject: string; text: string } {
  return {
    subject: 'Ton lien de connexion à Nomarque',
    text: [
      'Bonjour nomarque,',
      '',
      'Voici ton lien pour entrer dans ton nome :',
      link,
      '',
      `Il fonctionne une seule fois, pendant ${ttlMinutes} minutes.`,
      "Si tu n'as rien demandé, ignore ce message.",
      '',
      'Méri, scribe du nome',
    ].join('\n'),
  };
}

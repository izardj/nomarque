export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Sends e-mails. Swapped for an in-memory fake in tests. */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>;
}

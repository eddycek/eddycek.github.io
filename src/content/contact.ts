/** Contact details rendered in #kontakt and JSON-LD. Messaging rows render only when phone is set. */
export const contact = {
  handle: 'eddycek',
  email: 'eddycek.ve@gmail.com',
  /** E.164 without spaces is safest, e.g. '+420777123456'. Drives iMessage and WhatsApp links. */
  phone: '+420 7773 445 612' as string,
  links: [
    { label: 'Instagram', url: 'https://www.instagram.com/eddycek/' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/veder/' },
    { label: 'GitHub', url: 'https://github.com/eddycek' },
  ],
};

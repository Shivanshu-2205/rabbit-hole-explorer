// Placeholder for email utility
// Useful for password reset flows in the future
// When needed: install nodemailer and configure here

const sendMail = async ({ to, subject, html }) => {
  // TODO: implement with nodemailer when password reset is needed
  console.log(`[MAIL] To: ${to} | Subject: ${subject}`);
};

export { sendMail };
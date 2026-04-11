import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Send verification email ───────────────────────────────────────────────
export const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from:    `"Rabbit Hole" <${process.env.EMAIL_USER}>`,
    to:      email,
    subject: 'Verify your email — Rabbit Hole Explorer',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Welcome to Rabbit Hole Explorer!</h2>
        <p>Click the button below to verify your email. This link expires in <strong>24 hours</strong>.</p>
        <a href="${verifyUrl}"
           style="display:inline-block; padding:12px 24px; background:#4F46E5;
                  color:#fff; border-radius:6px; text-decoration:none; font-weight:bold;">
          Verify Email
        </a>
        <p style="margin-top:16px; color:#888; font-size:13px;">
          If you didn't create an account, ignore this email.
        </p>
      </div>
    `,
  });
};

// ── Generic send (for future use e.g. password reset) ─────────────────────
export const sendMail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"Rabbit Hole" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

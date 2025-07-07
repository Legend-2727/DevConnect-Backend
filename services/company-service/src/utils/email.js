import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false,                                  // true for 465
  auth: { user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS },
});

export async function sendShortlistMail({ to, company, job, shortlist }) {
  const subj = `Short-list for "${job.title}" is ready – ${shortlist.length} candidate(s)`;
  const rows = shortlist.map(
    c => `• User #${c.user_id} – score ${c.score} – ${c.justification}`
  ).join("\n");

  const body = `
Hi,

Here is the AI-generated shortlist for the position **${job.title}** at **${company.name}**:

${rows || "No candidates met the threshold."}

You can review full details in the DevConnect dashboard.

— DevConnect AI Recruiter
`;

  await mailer.sendMail({
    from: `"DevConnect AI" <${process.env.SMTP_FROM}>`,
    to,
    subject: subj,
    text: body,
  });

  return { to, subject: subj, body };
}

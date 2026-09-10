// Sending is wired up once the project's email sending address is configured.
export async function sendEmail(_input: { to: string; subject: string; text: string }) {
  throw new Error(
    "Email delivery isn't switched on yet — finish the one-time email setup and this button will send straight to your inbox.",
  );
}

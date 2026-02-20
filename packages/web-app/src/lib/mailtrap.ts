interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMfaEmail(email: string, code: string): Promise<void> {
  const options: SendEmailOptions = {
    to: email,
    subject: "Your verification code — Manuel Solis MCP",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1e3a5f; margin-bottom: 24px;">Verification Code</h2>
        <p style="color: #374151; font-size: 16px; line-height: 1.5;">
          Use the following code to complete your login:
        </p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1e3a5f;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
          This code expires in 10 minutes. If you did not request this, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          Abogados Manuel Solis — Database Console
        </p>
      </div>
    `,
    text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
  };

  await sendEmail(options);
}

async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<void> {
  const apiToken = process.env.MAILTRAP_API_TOKEN;
  const senderEmail = process.env.MAILTRAP_SENDER_EMAIL || "noreply@manuelsolis.com";
  const senderName = process.env.MAILTRAP_SENDER_NAME || "Manuel Solis MCP";

  if (!apiToken) {
    throw new Error("MAILTRAP_API_TOKEN is not defined");
  }

  const response = await fetch("https://send.api.mailtrap.io/api/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Token": apiToken,
    },
    body: JSON.stringify({
      from: {
        email: senderEmail,
        name: senderName,
      },
      to: [{ email: to }],
      subject,
      html,
      text,
    }),
  });

  const responseBody = await response.text();
  console.log(`[Mailtrap] Response: ${response.status} ${responseBody}`);

  if (!response.ok) {
    console.error("[Mailtrap] Send failed:", response.status, responseBody);
    throw new Error(`Failed to send email: ${response.status} - ${responseBody}`);
  }

  console.log(`[Mailtrap] MFA code sent to ${to}`);
}

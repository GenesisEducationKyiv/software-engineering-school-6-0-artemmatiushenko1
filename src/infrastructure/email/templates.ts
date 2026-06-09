interface BaseTemplate {
  subject: string;
  text: string;
  html: string;
}

const styles = {
  container: `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a; line-height: 1.6;`,
  card: `background-color: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);`,
  header: `margin-top: 0; margin-bottom: 24px; font-size: 24px; font-weight: 700; color: #24292e;`,
  text: `margin-bottom: 24px; font-size: 16px; color: #444d56;`,
  button: `display: inline-block; padding: 12px 24px; background-color: #2da44e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;`,
  footer: `margin-top: 32px; padding-top: 24px; border-top: 1px solid #e1e4e8; font-size: 13px; color: #6a737d; text-align: center;`,
  link: `color: #0366d6; text-decoration: none;`,
  code: `background-color: #f6f8fa; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; font-size: 14px; color: #24292e;`,
};

function wrapHtml(content: string, footerContent?: string): string {
  return `
    <div style="${styles.container}">
      <div style="${styles.card}">
        ${content}
        <div style="${styles.footer}">
          ${footerContent || 'Sent by GitHub Release Notifier'}
        </div>
      </div>
    </div>
  `;
}

export function subscriptionConfirmationTemplate(
  repo: string,
  confirmUrl: string,
): BaseTemplate {
  return {
    subject: `Confirm subscription: ${repo}`,
    text: `Please confirm your subscription to ${repo} by clicking here: ${confirmUrl}`,
    html: wrapHtml(`
      <h1 style="${styles.header}">Confirm subscription</h1>
      <p style="${styles.text}">
        You requested to receive release notifications for <b style="${styles.code}">${repo}</b>.
        Please confirm your subscription to start receiving updates.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${confirmUrl}" style="${styles.button}">Confirm Subscription</a>
      </div>
      <p style="${styles.text}">
        If you didn't request this, you can safely ignore this email.
      </p>
    `),
  };
}

export function subscriptionConfirmedTemplate(
  repo: string,
  unsubscribeUrl: string,
): BaseTemplate {
  const githubRepoUrl = `https://github.com/${repo}`;

  return {
    subject: `Subscription confirmed: ${repo}`,
    text: `Your subscription to ${repo} is now active. You'll receive notifications when new releases are published.\n\nTo unsubscribe: ${unsubscribeUrl}`,
    html: wrapHtml(
      `
      <h1 style="${styles.header}">Subscription confirmed</h1>
      <p style="${styles.text}">
        You're all set! You'll now receive release notifications for <b style="${styles.code}">${repo}</b>.
      </p>
      <div style="background-color: #f6f8fa; padding: 20px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e1e4e8;">
        <div style="font-size: 14px; color: #6a737d; margin-bottom: 4px;">Repository</div>
        <div style="font-size: 18px; font-weight: 600;">
          <a href="${githubRepoUrl}" style="${styles.link}">${repo}</a>
        </div>
      </div>
    `,
      `
      Stay up to date with <a href="${githubRepoUrl}" style="${styles.link}">${repo}</a>.<br/>
      <a href="${unsubscribeUrl}" style="${styles.link}">Unsubscribe</a> from these notifications.
    `,
    ),
  };
}

export function newReleaseNotificationTemplate(
  repo: string,
  tag: string,
  releaseName: string | null,
  unsubscribeUrl: string,
): BaseTemplate {
  const githubRepoUrl = `https://github.com/${repo}`;
  const releaseUrl = `${githubRepoUrl}/releases/tag/${tag}`;

  return {
    subject: `🚀 ${repo}: ${tag} released!`,
    text: `A new release ${tag} is available for ${repo}.\n\nView release: ${releaseUrl}\n\nTo unsubscribe: ${unsubscribeUrl}`,
    html: wrapHtml(
      `
      <h1 style="${styles.header}">New release available</h1>
      <p style="${styles.text}">
        A new version of <b style="${styles.code}">${repo}</b> has been published.
      </p>
      <div style="background-color: #f6f8fa; padding: 20px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e1e4e8;">
        <div style="font-size: 14px; color: #6a737d; margin-bottom: 4px;">Repository</div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">
          <a href="${githubRepoUrl}" style="${styles.link}">${repo}</a>
        </div>
        <div style="font-size: 14px; color: #6a737d; margin-bottom: 4px;">Release</div>
        <div style="font-size: 20px; font-weight: 700; color: #2da44e; margin-bottom: ${releaseName ? '8px' : '0'};">
          ${tag}
        </div>
        ${releaseName ? `<div style="font-size: 16px; color: #24292e; font-weight: 500;">${releaseName}</div>` : ''}
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${releaseUrl}" style="${styles.button}">View Release on GitHub</a>
      </div>
    `,
      `
      Stay up to date with <a href="${githubRepoUrl}" style="${styles.link}">${repo}</a>.<br/>
      <a href="${unsubscribeUrl}" style="${styles.link}">Unsubscribe</a> from these notifications.
    `,
    ),
  };
}

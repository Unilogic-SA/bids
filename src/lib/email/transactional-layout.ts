/** Email-safe equivalents of globals.css: primary violet-700, neutral text, 7px radius.
 * Inline styles and presentation tables intentionally replace application components.
 * Supabase HTML is generated from this same shell by scripts/preview-emails.ts.
 */
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function emailParagraph(content: string, secondary = false) {
  return `<p style="margin:0 0 20px;color:${secondary ? "#666666" : "#404040"};font-size:${secondary ? "14" : "16"}px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word;">${content}</p>`;
}

/** Arguments are trusted HTML; escape dynamic labels and URLs before passing. */
export function transactionalEmail(input: {
  title: string;
  body: string;
  action: string;
  href: string;
  reassurance: string;
}) {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<title>${input.title}</title>
<!--[if mso]><style>body,table,td,p,h1,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background-color:#ffffff;color:#171717;font-family:Inter,Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border-collapse:collapse;">
<tr><td align="center" style="padding:40px 16px;">
<!--[if mso]><table role="presentation" width="552" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:552px;border-collapse:collapse;">
<tr><td style="padding:0 8px 40px;font-family:Figtree,Inter,Arial,sans-serif;font-size:20px;line-height:28px;font-weight:600;letter-spacing:-0.4px;color:#171717;">OpenBids</td></tr>
<tr><td style="padding:0 8px;">
<h1 style="margin:0 0 20px;font-family:Figtree,Inter,Arial,sans-serif;font-size:28px;line-height:1.25;font-weight:600;letter-spacing:-0.5px;">${input.title}</h1>
${input.body}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px;border-collapse:separate;">
<tr><td bgcolor="#6d28d9" style="background-color:#6d28d9;border-radius:7px;text-align:center;mso-padding-alt:14px 24px;">
<a href="${input.href}" style="display:inline-block;border:1px solid #6d28d9;border-radius:7px;padding:13px 23px;font-size:16px;line-height:22px;font-weight:600;color:#ffffff;text-decoration:none;mso-padding-alt:0;"><!--[if mso]><i style="mso-font-width:150%;mso-text-raise:21pt;" hidden>&emsp;</i><![endif]--><span style="mso-text-raise:10pt;">${input.action}</span><!--[if mso]><i style="mso-font-width:150%;" hidden>&emsp;&#8203;</i><![endif]--></a>
</td></tr></table>
${emailParagraph(input.reassurance, true)}
</td></tr>
<tr><td style="padding:12px 8px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="border-top:1px solid #ebebeb;padding-top:20px;color:#666666;font-size:12px;line-height:18px;">OpenBids</td></tr></table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>`;
}

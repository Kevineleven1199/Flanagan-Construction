// Formats a captured lead for delivery to a notification webhook.
//
// Set LEAD_WEBHOOK_URL on the server to any of:
//   - a Slack incoming webhook (hooks.slack.com/...)   -> readable message
//   - a Discord webhook (discord.com/api/webhooks/...)  -> readable message
//   - anything else (Zapier / Make / n8n / a CRM)       -> raw lead JSON
// Zapier/Make can turn the raw JSON into an email, SMS, spreadsheet row, etc.

export function formatLeadMessage(lead) {
  const lines = [
    '🛁 New lead — Flanagan Construction',
    `Name: ${lead.name}`,
    `Phone: ${lead.phone}`,
  ]
  if (lead.email) lines.push(`Email: ${lead.email}`)
  if (lead.address) lines.push(`Address: ${lead.address}`)
  const meta = [lead.projectType, lead.budget, lead.timeline].filter(Boolean).join(' • ')
  if (meta) lines.push(meta)
  if (lead.message) lines.push('', lead.message)
  if (lead.receivedAt) lines.push('', `Received ${lead.receivedAt}`)
  return lines.join('\n')
}

export function buildWebhookPayload(webhookUrl, lead) {
  const url = String(webhookUrl || '')
  if (/hooks\.slack\.com\//i.test(url)) return { text: formatLeadMessage(lead) }
  if (/discord(?:app)?\.com\/api\/webhooks\//i.test(url)) return { content: formatLeadMessage(lead) }
  return lead
}

import { defaultSiteContent } from './content'

export const CONTENT_STORAGE_KEY = 'flanagan-site-content'
export const LEADS_STORAGE_KEY = 'flanagan-leads'
export const ADMIN_SESSION_KEY = 'flanagan-admin-auth'

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function mergeSiteContent(base = defaultSiteContent, overrides = {}) {
  if (Array.isArray(base)) return Array.isArray(overrides) ? overrides : base
  if (!isPlainObject(base)) return overrides ?? base

  const merged = { ...base }
  if (!isPlainObject(overrides)) return merged

  for (const [key, value] of Object.entries(overrides)) {
    merged[key] = mergeSiteContent(base[key], value)
  }

  return merged
}

export function cloneSiteContent(content) {
  return mergeSiteContent(defaultSiteContent, JSON.parse(JSON.stringify(content || {})))
}

export function loadStoredContent() {
  try {
    const stored = window.localStorage.getItem(CONTENT_STORAGE_KEY)
    if (!stored) return defaultSiteContent
    const parsed = JSON.parse(stored)
    if (parsed.contentVersion && parsed.contentVersion !== defaultSiteContent.contentVersion) {
      window.localStorage.removeItem(CONTENT_STORAGE_KEY)
      return defaultSiteContent
    }
    return mergeSiteContent(defaultSiteContent, parsed)
  } catch {
    return defaultSiteContent
  }
}

export function saveStoredContent(content) {
  try {
    window.localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(content))
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

export function resetStoredContent() {
  try {
    window.localStorage.removeItem(CONTENT_STORAGE_KEY)
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

export async function fetchPublishedContent() {
  const response = await fetch('/api/site-content', {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Content request failed: ${response.status}`)
  const payload = await response.json()
  const content = payload.content || payload
  if (content.contentVersion && content.contentVersion !== defaultSiteContent.contentVersion) return defaultSiteContent
  return mergeSiteContent(defaultSiteContent, content)
}

export function cssUrl(value) {
  const url = String(value || '').replace(/"/g, '%22')
  return `url("${url}")`
}

export function makeLeadId(lead = {}) {
  if (lead.id) return String(lead.id)
  const source = [
    lead.receivedAt,
    lead.createdAt,
    lead.name,
    lead.phone,
    lead.email,
    Math.random().toString(36).slice(2),
  ]
    .filter(Boolean)
    .join('-')
  return `lead-${source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64)}`
}

export function normalizeLead(lead = {}, index = 0) {
  const receivedAt = lead.receivedAt || lead.createdAt || new Date().toISOString()
  return {
    id: makeLeadId({ ...lead, receivedAt }) || `lead-${index}`,
    name: lead.name || 'Website lead',
    phone: lead.phone || '',
    email: lead.email || '',
    address: lead.address || '',
    addressPlaceId: lead.addressPlaceId || '',
    addressLat: lead.addressLat || '',
    addressLng: lead.addressLng || '',
    addressCity: lead.addressCity || '',
    addressState: lead.addressState || '',
    addressPostalCode: lead.addressPostalCode || '',
    projectType: lead.projectType || 'Project',
    budget: lead.budget || 'Not sure yet',
    timeline: lead.timeline || 'Planning ahead',
    message: lead.message || '',
    selectedNeeds: Array.isArray(lead.selectedNeeds) ? lead.selectedNeeds : [],
    funnelGroup: lead.funnelGroup || '',
    leadKind: lead.leadKind || 'Final request',
    status: lead.status || 'New',
    priority: lead.priority || 'Warm',
    estimateAmount: lead.estimateAmount || '',
    paymentLink: lead.paymentLink || '',
    followUpAt: lead.followUpAt || '',
    lastContactedAt: lead.lastContactedAt || '',
    emailStage: lead.emailStage || '',
    emailSubject: lead.emailSubject || '',
    emailBody: lead.emailBody || '',
    campaignName: lead.campaignName || '',
    campaignStep: lead.campaignStep || '',
    campaignNextAt: lead.campaignNextAt || '',
    campaignLastSentAt: lead.campaignLastSentAt || '',
    closeProbability: lead.closeProbability || '',
    quoteLaborCost: lead.quoteLaborCost || '',
    quoteMaterialCost: lead.quoteMaterialCost || '',
    quoteSubCost: lead.quoteSubCost || '',
    quoteOtherCost: lead.quoteOtherCost || '',
    quoteMarkupPercent: lead.quoteMarkupPercent || '',
    quoteCustomerPrice: lead.quoteCustomerPrice || '',
    quoteDepositPercent: lead.quoteDepositPercent || '',
    revenueReceived: lead.revenueReceived || '',
    expenseTotal: lead.expenseTotal || '',
    joistClientName: lead.joistClientName || '',
    joistEstimateNumber: lead.joistEstimateNumber || '',
    joistInvoiceNumber: lead.joistInvoiceNumber || '',
    joistStatus: lead.joistStatus || '',
    nextStep: lead.nextStep || '',
    notes: lead.notes || '',
    receivedAt,
    updatedAt: lead.updatedAt || '',
  }
}

export function loadStoredLeads() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(LEADS_STORAGE_KEY) || '[]')
    return stored.map(normalizeLead)
  } catch {
    return []
  }
}

export function saveStoredLeads(leads) {
  try {
    window.localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads.map(normalizeLead).slice(0, 200)))
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

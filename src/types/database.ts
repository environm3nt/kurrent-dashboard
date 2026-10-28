export interface Lead {
  id: string
  client_id: string
  company_name: string
  role_title: string
  seniority_tier?: string
  location?: string
  status: 'New' | 'Reviewing' | 'Viewed' | 'Contacted' | 'Proposal' | 'Won' | 'Lost' | 'Archived'
  date_identified: string
  industry?: string
  salary_range?: string
  company_headcount?: string
  hiring_contact_name?: string
  hiring_contact_title?: string
  hiring_contact_email?: string
  hiring_contact_linkedin?: string
  company_domain?: string
  contact_quality?: 'verified' | 'partial' | 'none'
  time_to_fill_estimate?: string
  sales_talking_points?: string
  competing_postings?: string
  talent_availability?: string
  market_insight?: string
  scarcity_insight?: string
  competition_insight?: string
  speed_insight?: string
  active_candidates?: number
  passive_candidates?: number
  role_change_drivers?: string
  candidate_1_name?: string
  candidate_1_url?: string
  candidate_1_headline?: string
  candidate_1_signal?: string
  candidate_1_match_score?: number
  candidate_1_matched_skills?: string
  candidate_2_name?: string
  candidate_2_url?: string
  candidate_2_headline?: string
  candidate_2_signal?: string
  candidate_2_match_score?: number
  candidate_2_matched_skills?: string
  candidate_3_name?: string
  candidate_3_url?: string
  candidate_3_headline?: string
  candidate_3_signal?: string
  candidate_3_match_score?: number
  candidate_3_matched_skills?: string
  candidate_pitch_points?: string
  job_posting_url?: string
  pdf_report_link?: string
  assigned_to_user_id?: string
  projected_fee?: number
  created_at: string
  updated_at: string
}

export interface PipelineRun {
  id: string
  client_id: string
  status: 'success' | 'failed' | 'running' | 'queued'
  started_at: string
  completed_at?: string
  leads_created: number
  jobs_discovered: number
  created_at: string
}

export interface Client {
  id: string
  agency_name: string
  agency_initials?: string
  contact_name: string
  brand_primary_color: string
  brand_accent_color?: string
  tier: 'starter' | 'growth' | 'enterprise' | 'scale' | 'founding_partner'
  timezone: string
  target_locations?: string[]
  target_roles?: Array<{ title: string; seniority?: string; seniorities?: string[]; locations?: string[] }>
  max_results_per_role?: number
  digest_send_time?: string
  digest_recipients?: {
    to: string[]
    cc: string[]
    from: string
    replyTo: string
  }
  generate_pdfs?: boolean
  created_at: string
  updated_at: string
  sales_rep_name?: string | null
  sales_rep_title?: string | null
  sales_rep_email?: string | null
  agency_phone?: string | null
  agency_website?: string | null
  allowed_admin_emails?: string[]
}

export interface UserClient {
  id: string
  user_id: string
  client_id: string
  role: 'owner' | 'admin' | 'member'
  contact_name?: string | null
  contact_title?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  created_at: string
}

export interface ClientInvitation {
  id: string
  client_id: string
  email: string
  role: 'admin' | 'member'
  invited_by: string
  status: 'pending' | 'accepted' | 'revoked'
  created_at: string
  expires_at: string
  accepted_at?: string
}

export interface ApiUsage {
  id: string
  client_id: string
  cost_usd: number
  recorded_at: string
}

export interface IndustryBrief {
  id: string
  client_id: string
  user_id: string
  industry: string
  location: string
  target_company: string
  status: 'generating' | 'ready' | 'failed'
  pdf_url?: string | null
  error_message?: string | null
  created_at: string
  updated_at: string
}

export interface RecruiterConfig {
  id: string
  client_id: string
  user_id: string
  target_roles: Array<{ title: string; function?: string; seniority?: string; seniorities?: string[]; locations?: string[] }>
  target_locations: string[]
  schedule: Record<string, string[]>  // e.g. {"Legal Assistant": ["mon","tue","wed"]}
  digest_enabled: boolean
  digest_days: string[]
  display_name?: string
  created_at: string
  updated_at: string
}

export interface LeadNote {
  id: string
  lead_id: string
  client_id: string
  user_id: string
  user_name: string
  content: string
  created_at: string
}

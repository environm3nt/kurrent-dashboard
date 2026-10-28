-- ============================================
-- Replace you@example.com below with the address you sign in with.
-- DEMO ACCOUNT: Northbridge Talent Group
-- Realistic fake recruitment agency with sample leads
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- 1. Create the demo client
INSERT INTO clients (
  id, name, agency_name, agency_initials, tier, status,
  contact_email, contact_name,
  brand_primary_color, brand_accent_color,
  white_label, target_roles, target_locations,
  max_results_per_role, digest_recipients,
  digest_send_time, timezone, generate_pdfs,
  storage_preference, allowed_admin_emails,
  sales_rep_name, sales_rep_title, sales_rep_email,
  agency_phone, agency_website
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Northbridge Talent Group',
  'Northbridge Talent Group',
  'NT',
  'growth',
  'active',
  'you@example.com',
  'Demo Admin',
  '#2F2C25',
  '#F1EADD',
  false,
  '[{"title": "Software Engineer", "function": "Engineering", "seniority": "IC"}, {"title": "Product Manager", "function": "Product", "seniority": "Manager"}, {"title": "Data Analyst", "function": "Analytics", "seniority": "IC"}, {"title": "UX Designer", "function": "Design", "seniority": "IC"}, {"title": "Marketing Manager", "function": "Marketing", "seniority": "Manager"}, {"title": "Sales Development Rep", "function": "Sales", "seniority": "IC"}]'::jsonb,
  '["Toronto Ontario Canada", "Vancouver British Columbia Canada", "Calgary Alberta Canada"]'::jsonb,
  3,
  '{"to": ["you@example.com"], "cc": [], "from": "Kurrent <kurrent@kurrentlabs.com>", "replyTo": "hello@kurrentlabs.com"}'::jsonb,
  '08:00',
  'America/Toronto',
  false,
  'onedrive',
  ARRAY['you@example.com'],
  'Alex Chen',
  'Senior Recruiter',
  'alex@northbridgetalent.com',
  '(416) 555-0199',
  'northbridgetalent.com'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Link your login to the demo client.
-- NOTE: the user must have signed in at least once. The auto-provisioning in layout.tsx handles this
-- automatically via allowed_admin_emails. But we can also pre-create the mapping:
INSERT INTO user_clients (user_id, client_id, role, contact_email, contact_name)
SELECT
  au.id,
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'admin',
  'you@example.com',
  'Demo Admin'
FROM auth.users au
WHERE au.email = 'you@example.com'
ON CONFLICT (user_id, client_id) DO NOTHING;

-- 3. Seed realistic demo leads (20 leads across different roles, statuses, and quality levels)
INSERT INTO leads (
  client_id, company_name, role_title, industry, seniority_tier, work_arrangement,
  location, date_identified, job_posting_url, company_headcount, years_in_business,
  hiring_contact_name, hiring_contact_title, hiring_contact_email, hiring_contact_linkedin,
  company_domain, contact_quality, salary_range, time_to_fill_estimate,
  active_candidates, passive_candidates, role_change_drivers,
  sales_talking_points, candidate_pitch_points, source, status,
  candidate_1_name, candidate_1_url, candidate_2_name, candidate_2_url
) VALUES

-- Lead 1: Software Engineer — Verified, New
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Maple Leaf Technologies', 'Software Engineer', 'Technology', 'IC', 'Hybrid',
 'Toronto Ontario Canada', CURRENT_DATE, 'https://linkedin.com/jobs/view/example-1',
 '250', '8', 'David Park', 'VP Engineering', 'david.park@mapleleaftech.ca', 'https://example.com/in/davidpark',
 'mapleleaftech.ca', 'verified', '$95,000 - $125,000', '35 days',
 4, 12, 'Expanding engineering team after Series B funding',
 '• Maple Leaf just raised $18M Series B — hiring aggressively\n• VP Engineering is decision-maker and responds to LinkedIn outreach\n• They lost two senior devs last quarter — urgency is high',
 '• Strong React/Node stack — appealing to full-stack candidates\n• Hybrid model (3 days office) in Liberty Village\n• Stock options vesting over 4 years',
 'linkedin', 'New',
 'Priya Sharma', 'https://example.com/in/priyasharma-dev',
 'Marcus Williams', 'https://example.com/in/marcuswilliams-eng'),

-- Lead 2: Product Manager — Verified, New
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Northern Shield Insurance', 'Product Manager', 'Insurance', 'Manager', 'On-site',
 'Toronto Ontario Canada', CURRENT_DATE, 'https://linkedin.com/jobs/view/example-2',
 '1200', '22', 'Rachel Torres', 'Director of Product', 'rachel.torres@northernshield.ca', 'https://example.com/in/racheltorres',
 'northernshield.ca', 'verified', '$110,000 - $140,000', '42 days',
 2, 8, 'Digital transformation initiative — modernizing claims platform',
 '• Northern Shield is a $2B insurer — stable, enterprise client\n• Digital transformation budget approved for 2026\n• Rachel Torres actively posting about hiring needs on LinkedIn',
 '• Product-led org with real autonomy\n• Insurance is recession-proof — job security\n• Competitive benefits package including pension',
 'indeed', 'New',
 'Jason Liu', 'https://example.com/in/jasonliu-pm',
 'Amara Okonkwo', 'https://example.com/in/amaraokonkwo'),

-- Lead 3: Data Analyst — Partial contact, New
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Brightpath Analytics', 'Data Analyst', 'Consulting', 'IC', 'Remote',
 'Vancouver British Columbia Canada', CURRENT_DATE - INTERVAL '1 day', 'https://linkedin.com/jobs/view/example-3',
 '85', '5', 'James Wilson', 'Head of Analytics', '', '',
 'brightpathanalytics.com', 'partial', '$75,000 - $95,000', '28 days',
 6, 15, 'New government contract requires data team expansion',
 '• Won federal analytics contract — guaranteed 3-year revenue\n• Small team, high impact — analysts work directly with clients\n• Fully remote — can recruit nationally',
 '• Remote-first since founding — not a pandemic pivot\n• Government contract = job stability\n• Exposure to diverse public sector datasets',
 'linkedin', 'New',
 'Emily Zhang', 'https://example.com/in/emilyzhang-data',
 NULL, NULL),

-- Lead 4: UX Designer — Verified, Contacted
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Canopy Health', 'UX Designer', 'Healthcare', 'IC', 'Hybrid',
 'Toronto Ontario Canada', CURRENT_DATE - INTERVAL '2 days', 'https://linkedin.com/jobs/view/example-4',
 '400', '12', 'Michelle Huang', 'Design Director', 'michelle.huang@canopyhealth.ca', 'https://example.com/in/michellehuang',
 'canopyhealth.ca', 'verified', '$85,000 - $110,000', '30 days',
 3, 9, 'Redesigning patient portal — regulatory deadline Q3 2026',
 '• Hard deadline (regulatory) — they NEED to fill this\n• Michelle is design-forward leader, good selling point for candidates\n• Budget pre-approved, no procurement delays',
 '• Healthcare UX is meaningful work — strong for mission-driven candidates\n• Design system already in place (Figma)\n• Hybrid 2 days/week, downtown Toronto',
 'linkedin', 'Contacted',
 'Raj Patel', 'https://example.com/in/rajpatel-ux',
 'Anna Kowalski', 'https://example.com/in/annakowalski-design'),

-- Lead 5: Marketing Manager — Verified, New
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Summit Outdoor Co.', 'Marketing Manager', 'Retail', 'Manager', 'Hybrid',
 'Calgary Alberta Canada', CURRENT_DATE, 'https://indeed.com/viewjob?jk=example-5',
 '150', '10', 'Tom Bradley', 'CMO', 'tom.bradley@summitoutdoor.ca', 'https://example.com/in/tombradley',
 'summitoutdoor.ca', 'verified', '$90,000 - $115,000', '38 days',
 2, 7, 'Launching DTC e-commerce channel — need marketing leadership',
 '• Summit is a beloved Canadian outdoor brand — great employer brand\n• DTC launch is greenfield — the hire gets to build from scratch\n• CMO is the direct report — short decision chain',
 '• Build the DTC marketing function from zero\n• Outdoor industry passion — lifestyle alignment\n• Calgary cost of living advantage over Toronto/Vancouver',
 'indeed', 'New',
 NULL, NULL,
 NULL, NULL),

-- Lead 6: Software Engineer — Verified, Viewed
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Fintech Bridge', 'Software Engineer', 'Financial Services', 'IC', 'Remote',
 'Toronto Ontario Canada', CURRENT_DATE - INTERVAL '1 day', 'https://linkedin.com/jobs/view/example-6',
 '60', '3', 'Aisha Mohammed', 'CTO', 'aisha.mohammed@fintechbridge.io', 'https://example.com/in/aishamohammed',
 'fintechbridge.io', 'verified', '$110,000 - $145,000', '25 days',
 5, 18, 'Scaling payments platform — 3x transaction volume expected by Q4',
 '• Early-stage fintech with real revenue — not pre-product\n• CTO is the decision-maker and very responsive\n• Competing with big banks for talent — urgency to close fast',
 '• Ground floor of a scaling fintech — equity upside\n• Fully remote, async-first culture\n• Modern stack: Go, Kubernetes, event-driven architecture',
 'linkedin', 'Viewed',
 'Kevin Nguyen', 'https://example.com/in/kevinnguyen-swe',
 'Lisa Chen', 'https://example.com/in/lisachen-eng'),

-- Lead 7: Sales Development Rep — No contact, New
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'CloudSync Solutions', 'Sales Development Rep', 'SaaS', 'IC', 'Hybrid',
 'Vancouver British Columbia Canada', CURRENT_DATE, 'https://indeed.com/viewjob?jk=example-7',
 '180', '6', '', '', '', '',
 'cloudsyncsolutions.com', 'none', '$55,000 - $75,000 + commission', '20 days',
 8, 22, 'New enterprise sales motion — building outbound team from scratch',
 '• CloudSync growing 40% YoY — real traction in mid-market\n• Building outbound team = career growth opportunity for SDRs\n• Commission structure is uncapped',
 '• Uncapped commission — top SDRs earning $100K+\n• Clear promotion path to AE within 12-18 months\n• SaaS experience not required — they train',
 'indeed', 'New',
 NULL, NULL,
 NULL, NULL),

-- Lead 8: Product Manager — Verified, Won
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Redwood Logistics', 'Product Manager', 'Logistics', 'Manager', 'On-site',
 'Calgary Alberta Canada', CURRENT_DATE - INTERVAL '5 days', 'https://linkedin.com/jobs/view/example-8',
 '500', '15', 'Nicole Fisher', 'VP Product', 'nicole.fisher@redwoodlogistics.ca', 'https://example.com/in/nicolefisher',
 'redwoodlogistics.ca', 'verified', '$105,000 - $130,000', '45 days',
 1, 5, 'Building route optimization platform — replacing legacy system',
 '• Redwood is the largest independent logistics firm in Alberta\n• Nicole Fisher has budget authority — decision-maker\n• Legacy replacement = multi-year engagement opportunity',
 '• Greenfield product build — rare in logistics\n• Company-funded relocation package\n• Calgary is booming — lifestyle + affordability',
 'linkedin', 'Won',
 'Daniel Kim', 'https://example.com/in/danielkim-pm',
 NULL, NULL),

-- Lead 9: Data Analyst — Verified, Contacted
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Aurora Mining Corp', 'Data Analyst', 'Mining', 'IC', 'On-site',
 'Calgary Alberta Canada', CURRENT_DATE - INTERVAL '3 days', 'https://linkedin.com/jobs/view/example-9',
 '3000', '35', 'Robert Chen', 'Director of Operations Analytics', 'robert.chen@auroramining.ca', 'https://example.com/in/robertchen',
 'auroramining.ca', 'verified', '$80,000 - $100,000', '50 days',
 2, 6, 'ESG reporting requirements driving analytics investment',
 '• Aurora is a TSX-listed miner — enterprise-grade client\n• ESG compliance is mandatory — they must hire\n• Robert Chen is a warm contact — spoke at Data Summit 2025',
 '• Mining analytics is niche — premium compensation\n• On-site in downtown Calgary (not remote mine site)\n• Stability of a 35-year-old public company',
 'linkedin', 'Contacted',
 'Samantha Lee', 'https://example.com/in/samanthalee-analytics',
 'Chris Morrison', 'https://example.com/in/chrismorrison-data'),

-- Lead 10: Software Engineer — Partial, New
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Pacific Robotics', 'Software Engineer', 'Robotics', 'IC', 'On-site',
 'Vancouver British Columbia Canada', CURRENT_DATE, 'https://linkedin.com/jobs/view/example-10',
 '45', '2', 'Dr. Wei Zhang', 'CEO', '', '',
 'pacificrobotics.ai', 'partial', '$100,000 - $130,000', '30 days',
 3, 10, 'Series A funding — tripling engineering team',
 '• Just closed $12M Series A — aggressive hiring mode\n• CEO is technical (PhD Robotics) — candidates respect that\n• Only 45 people — huge impact potential',
 '• Cutting-edge robotics + AI — dream job for builders\n• Series A = equity still cheap\n• Vancouver waterfront office',
 'linkedin', 'New',
 'Jordan Taylor', 'https://example.com/in/jordantaylor-robotics',
 'Mai Tran', 'https://example.com/in/maitran-swe'),

-- Lead 11: UX Designer — No contact, Viewed
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'EduVault', 'UX Designer', 'EdTech', 'IC', 'Remote',
 'Toronto Ontario Canada', CURRENT_DATE - INTERVAL '2 days', 'https://indeed.com/viewjob?jk=example-11',
 '95', '4', '', '', '', '',
 'eduvault.io', 'none', '$80,000 - $100,000', '25 days',
 4, 14, 'Redesigning learning platform for accessibility compliance',
 '• EdTech is growing 25% annually — sector tailwind\n• Accessibility compliance is a must-do — budget secured\n• Small team = direct influence on product direction',
 '• Accessibility-first design — meaningful impact\n• Fully remote with annual team retreats\n• EdTech mission resonates with design candidates',
 'indeed', 'Viewed',
 NULL, NULL,
 NULL, NULL),

-- Lead 12: Marketing Manager — Verified, New
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Glacier Brewing Company', 'Marketing Manager', 'Food & Beverage', 'Manager', 'On-site',
 'Vancouver British Columbia Canada', CURRENT_DATE, 'https://linkedin.com/jobs/view/example-12',
 '120', '8', 'Mike O''Brien', 'Founder & CEO', 'mike.obrien@glacierbrewing.ca', 'https://example.com/in/mikeobrien-glacier',
 'glacierbrewing.ca', 'verified', '$85,000 - $105,000', '32 days',
 1, 5, 'National expansion — entering Ontario and Alberta markets',
 '• Glacier is BC''s fastest-growing craft brewery — great brand story\n• National expansion = big marketing budget\n• CEO is the direct report — fast decisions',
 '• Craft beer industry — fun employer brand\n• National scope — not just local marketing\n• Growing company with promotion potential',
 'linkedin', 'New',
 NULL, NULL,
 NULL, NULL),

-- Lead 13: Software Engineer — Verified, Lost
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Quantum Secure', 'Software Engineer', 'Cybersecurity', 'IC', 'Hybrid',
 'Toronto Ontario Canada', CURRENT_DATE - INTERVAL '8 days', 'https://linkedin.com/jobs/view/example-13',
 '200', '7', 'Laura Schmidt', 'Engineering Manager', 'laura.schmidt@quantumsecure.ca', 'https://example.com/in/lauraschmidt',
 'quantumsecure.ca', 'verified', '$105,000 - $135,000', '40 days',
 3, 11, 'Government security contract requires cleared developers',
 '• Government contract = stable multi-year revenue\n• Security clearance requirement narrows candidate pool\n• Laura is responsive and professional — good client relationship',
 '• Cybersecurity is recession-proof\n• Security clearance opens future career doors\n• Hybrid with flexible hours',
 'linkedin', 'Lost',
 'Alex Rivera', 'https://example.com/in/alexrivera-sec',
 'Jordan Park', 'https://example.com/in/jordanpark-dev'),

-- Lead 14: Sales Development Rep — Verified, Contacted
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'TrueNorth CRM', 'Sales Development Rep', 'SaaS', 'IC', 'Remote',
 'Toronto Ontario Canada', CURRENT_DATE - INTERVAL '1 day', 'https://linkedin.com/jobs/view/example-14',
 '75', '4', 'Chris Martinez', 'VP Sales', 'chris.martinez@truenorthcrm.com', 'https://example.com/in/chrismartinez-sales',
 'truenorthcrm.com', 'verified', '$50,000 - $65,000 + commission', '18 days',
 7, 20, 'Doubling sales team after hitting $5M ARR milestone',
 '• TrueNorth hit $5M ARR — proven product-market fit\n• VP Sales is building his team — direct mentorship opportunity\n• Fast-growing SaaS = career accelerator for SDRs',
 '• $5M ARR company — stability + startup energy\n• VP Sales as direct mentor — rare for SDR roles\n• Remote-first, Canadian company',
 'linkedin', 'Contacted',
 NULL, NULL,
 NULL, NULL),

-- Lead 15: Data Analyst — Verified, New
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'Harvest Health Foods', 'Data Analyst', 'CPG', 'IC', 'Hybrid',
 'Toronto Ontario Canada', CURRENT_DATE, 'https://indeed.com/viewjob?jk=example-15',
 '350', '18', 'Nina Patel', 'VP Operations', 'nina.patel@harvesthealthfoods.ca', 'https://example.com/in/ninapatel',
 'harvesthealthfoods.ca', 'verified', '$70,000 - $90,000', '35 days',
 3, 8, 'Supply chain optimization project — need analytics support',
 '• Harvest is a top-5 Canadian health food brand — brand recognition\n• Supply chain analytics is high-impact, high-visibility\n• Nina Patel is warm — responded to first outreach',
 '• Health food industry is growing 15% YoY\n• Data-driven decision making culture\n• Hybrid in midtown Toronto — great office location',
 'indeed', 'New',
 'Olivia Chen', 'https://example.com/in/oliviachen-analyst',
 NULL, NULL);

-- 4. Add a couple of pipeline runs so the dashboard shows run history
INSERT INTO pipeline_runs (
  client_id, status, started_at, completed_at, leads_created, jobs_discovered
) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'success',
 NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '18 minutes',
 8, 24),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'success',
 NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '22 minutes',
 7, 19);

-- 5. Verify — you should see Northbridge with 15 leads
SELECT
  c.agency_name,
  c.tier,
  COUNT(l.id) as lead_count,
  COUNT(CASE WHEN l.contact_quality = 'verified' THEN 1 END) as verified_contacts,
  COUNT(CASE WHEN l.status = 'New' THEN 1 END) as new_leads
FROM clients c
LEFT JOIN leads l ON l.client_id = c.id
WHERE c.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
GROUP BY c.agency_name, c.tier;

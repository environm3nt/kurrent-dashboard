import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * Send a brand-compliant invitation email via Resend.
 * Non-blocking — logs errors but doesn't fail the invitation creation.
 */
async function sendInvitationEmail(
  toEmail: string,
  clientName: string,
  inviterName: string | null,
  role: string
) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[Invitations] RESEND_API_KEY not set — skipping invitation email')
    return
  }

  const roleLabel = role === 'admin' ? 'an admin' : 'a team member'
  const invitedBy = inviterName || 'your team admin'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.kurrentlabs.com'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#FEFAF3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FEFAF3;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background-color:#FAF9F5;border-radius:16px;border:1px solid #F1EADD;">

<!-- Logo -->
<tr><td style="padding:32px 32px 0 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="34" height="34" style="width:34px;height:34px;background-color:#2F2C25;border-radius:8px;text-align:center;vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:normal;color:#FEFAF3;line-height:34px;">K</td>
<td style="padding-left:10px;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:bold;color:#2F2C25;">Kurrent</td>
</tr></table>
</td></tr>

<!-- Heading -->
<tr><td style="padding:28px 32px 0 32px;">
<h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;color:#2F2C25;line-height:1.3;">You've been invited to join ${clientName}</h1>
</td></tr>

<!-- Body -->
<tr><td style="padding:16px 32px 0 32px;">
<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#7A7468;line-height:1.6;">
${invitedBy} has invited you as ${roleLabel} on <strong style="color:#2F2C25;">${clientName}</strong>'s Kurrent intelligence portal. Sign in to access your daily lead briefings, market intelligence, and candidate insights.
</p>
</td></tr>

<!-- CTA Button -->
<tr><td style="padding:28px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background-color:#2F2C25;border-radius:9px;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${appUrl}/login" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="20%" fillcolor="#2F2C25" stroke="f"><v:textbox inset="0,0,0,0"><center style="font-family:sans-serif;font-size:14px;font-weight:600;color:#FEFAF3;">Sign in to Kurrent</center></v:textbox></v:roundrect><![endif]-->
<a href="${appUrl}/login" style="display:inline-block;padding:12px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#FEFAF3;text-decoration:none;border-radius:9px;background-color:#2F2C25;mso-hide:all;">Sign in to Kurrent</a>
</td>
</tr></table>
</td></tr>

<!-- Divider -->
<tr><td style="padding:0 32px;">
<div style="height:1px;background-color:#F1EADD;font-size:0;line-height:0;">&nbsp;</div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px 28px 32px;">
<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#9A9084;line-height:1.5;">
Sign in with the Google or Microsoft account associated with <strong>${toEmail}</strong>. If you have trouble, reply to this email or contact <a href="mailto:hello@kurrentlabs.com" style="color:#2F2C25;text-decoration:underline;">hello@kurrentlabs.com</a>.
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Kurrent <kurrent@kurrentlabs.com>',
        to: [toEmail],
        reply_to: 'hello@kurrentlabs.com',
        subject: `You've been invited to join ${clientName} on Kurrent`,
        html,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[Invitations] Resend error:', response.status, errorBody)
    } else {
      const result = await response.json()
      console.log('[Invitations] Email sent to', toEmail, '— messageId:', result.id)
    }
  } catch (err) {
    console.error('[Invitations] Failed to send email:', err)
  }
}

/**
 * GET /api/invitations
 *
 * List all invitations for the current user's client.
 * Also returns current team members.
 * Admin-only (checks role from user_clients).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's client and verify admin role
  const { data } = await supabase
    .from('user_clients')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userClient = data?.[0] || null

  if (!userClient) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  const rawRole = userClient.role as string
  const isAdmin = rawRole === 'admin' || rawRole === 'owner'
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Get pending invitations
  const { data: invitations, error: invError } = await supabase
    .from('client_invitations')
    .select('*')
    .eq('client_id', userClient.client_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (invError) {
    console.error('[Invitations API] Error fetching invitations:', invError)
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
  }

  // Get current team members
  const { data: members, error: membersError } = await supabase
    .from('user_clients')
    .select('id, user_id, role, contact_name, contact_email, created_at')
    .eq('client_id', userClient.client_id)
    .order('created_at', { ascending: true })

  if (membersError) {
    console.error('[Invitations API] Error fetching members:', membersError)
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 })
  }

  return NextResponse.json({
    invitations: invitations || [],
    members: members || [],
    currentUserId: user.id,
  })
}

/**
 * POST /api/invitations
 *
 * Create a new invitation. Admin-only.
 * Body: { email: string, role: 'admin' | 'member' }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's client and verify admin role
  const { data } = await supabase
    .from('user_clients')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userClient = data?.[0] || null

  if (!userClient) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  const rawRole = userClient.role as string
  const isAdmin = rawRole === 'admin' || rawRole === 'owner'
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const { email, role } = body

  if (!email || !['admin', 'member'].includes(role)) {
    return NextResponse.json(
      { error: 'Provide a valid email and role (admin or member).' },
      { status: 400 }
    )
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Check if already a team member
  const { data: existingMembers } = await supabase
    .from('user_clients')
    .select('contact_email')
    .eq('client_id', userClient.client_id)

  const memberEmails = (existingMembers || []).map(m => m.contact_email?.toLowerCase())
  if (memberEmails.includes(normalizedEmail)) {
    return NextResponse.json(
      { error: 'This person is already a team member.' },
      { status: 409 }
    )
  }

  // Create invitation (expires in 7 days)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: invitation, error: insertError } = await supabase
    .from('client_invitations')
    .insert({
      client_id: userClient.client_id,
      email: normalizedEmail,
      role,
      invited_by: user.id,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email.' },
        { status: 409 }
      )
    }
    console.error('[Invitations API] Error creating invitation:', insertError)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }

  // Send invitation email (non-blocking — don't fail the response if email fails)
  const serviceClient = createServiceClient() || supabase
  const { data: clientData } = await serviceClient
    .from('clients')
    .select('agency_name')
    .eq('id', userClient.client_id)
    .single()

  const clientName = clientData?.agency_name || 'your team'
  const inviterName = user.user_metadata?.full_name || user.user_metadata?.name || null

  // Fire and forget — don't await in the response path
  sendInvitationEmail(normalizedEmail, clientName, inviterName, role).catch(err => {
    console.error('[Invitations] Background email send failed:', err)
  })

  return NextResponse.json({ invitation }, { status: 201 })
}

/**
 * DELETE /api/invitations
 *
 * Revoke an invitation. Admin-only.
 * Body: { invitationId: string }
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's client and verify admin role
  const { data } = await supabase
    .from('user_clients')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const userClient = data?.[0] || null

  if (!userClient) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  const rawRole = userClient.role as string
  const isAdmin = rawRole === 'admin' || rawRole === 'owner'
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const { invitationId } = body

  if (!invitationId) {
    return NextResponse.json({ error: 'Provide invitationId.' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('client_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('client_id', userClient.client_id)

  if (updateError) {
    console.error('[Invitations API] Error revoking invitation:', updateError)
    return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

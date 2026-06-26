// Optional email notifications for help/reset requests via EmailJS (a no-backend
// client-side email service). It stays a silent no-op until you provide keys in
// .env (or the GitHub Actions build) — the request is always stored in Firestore
// and visible in Operations Centre → Help regardless.
//
// To enable: create a free account at emailjs.com, add an email service + a
// template with {{subject}} and {{message}} variables, then set:
//   VITE_EMAILJS_SERVICE, VITE_EMAILJS_TEMPLATE, VITE_EMAILJS_PUBLIC_KEY
// The admin address that receives mail is configured on the EmailJS template.

const SERVICE = import.meta.env.VITE_EMAILJS_SERVICE
const TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export async function notifyAdmin(subject, message) {
  if (!SERVICE || !TEMPLATE || !PUBLIC_KEY) return false
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: SERVICE,
        template_id: TEMPLATE,
        user_id: PUBLIC_KEY,
        template_params: { subject, message },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

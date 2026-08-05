# SaaS benchmark project

Auth · Billing · Permissions

## Seed decisions

- RBAC via permissions service
- Billing = Stripe + local invoices
- Auth sessions = httpOnly cookies
- Permission bypass incident (tenant scoping)

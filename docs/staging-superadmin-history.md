# Staging Superadmin History

## Purpose

This file keeps the working memory for the `superadmin` profile changes in `staging`.
Use it to preserve decisions, deployed changes, protections, and next steps when the conversation context grows.

## Working Rules

- All superadmin changes are applied to `staging` first.
- Production is updated only after explicit approval.
- The app is being moved to a single monthly subscription model with full access.
- If subscription status is blocked, app access can be blocked.
- The superadmin tenant must never be deletable.

## Current Product Direction

- The superadmin area should feel more intuitive, modern, and powerful.
- The business model is SaaS with one monthly plan.
- The monthly base price and currency are managed from `Superadmin > Ajustes`.
- Existing tenants should align to the unified subscription plan.

## Implemented In Staging

### Subscription Model

- Unified monthly plan created as the default subscription model.
- Base monthly price and currency are editable from settings.
- Existing tenant subscriptions are aligned to the unified plan.
- Blocked access flow exists for suspended or cancelled subscriptions.
- The subscription model is being simplified to only two operational states: `active` and `suspended`.
- New tenants now start in `active` by default.
- The monthly cycle now evaluates overdue unpaid accounts and can suspend them automatically.

### Superadmin UX

- Superadmin dashboard was redesigned into a clearer command-center style.
- Main dock navigation was simplified to reduce confusion.
- Operational metrics, alerts, and direct workspace cards were added.

### Tenant Management

- Tenants can now be deleted from `Superadmin > Tenants`.
- Deletion removes related tenant records and users.
- The superadmin tenant is protected in both UI and backend.
- Protected tenants are labeled as `Protegido`.

### Phase 2 In Progress

- `Suscripciones y cobros` now includes a per-tenant detail drawer.
- The drawer shows tenant summary, quick subscription controls, recent invoices, and recent payments.
- Subscription state, next billing date, and internal notes can be updated from the drawer.
- The `Detalle` action was integrated better into the row layout so it feels native to the control block.
- The tenant drawer now includes direct billing actions:
  - generate invoice,
  - choose a pending invoice,
  - register a confirmed payment from the same panel.
- Invoice lists now surface pending balance per invoice to make collection work clearer.
- The tenant drawer now also includes direct operational actions to suspend or reactivate tenant access without editing the status manually.
- Superadmin now receives a notification when a new tenant is created, so onboarding activity is visible from the admin profile.
- PWA push configuration is now being extended so the superadmin can subscribe a device directly from `Superadmin > Ajustes`.
- New-tenant alerts are now also being prepared to arrive as push notifications, not only inside the notifications center.

## Protection Rules

- Do not show delete action for protected superadmin tenant.
- Reject protected tenant deletion from backend even if API is called manually.
- Do not delete production resources unless explicitly requested.

## Current Staging Status

- Superadmin dashboard has a more modern visual style.
- Subscription settings are functional.
- Tenant deletion is functional with protected-tenant safeguards.
- Subscription management is moving toward a single-screen operational flow with tenant detail drawer.
- The platform is converging toward a stricter SaaS enforcement model with automatic suspension on unpaid monthly renewal.
- Push notification testing is part of the current staging validation scope, especially for new tenant signups viewed from the superadmin profile.
- Backend push/notifications flow now includes compatibility handling for legacy staging schemas where `tenant_id` can still be `NOT NULL` in `notifications` and `push_subscriptions`.
- User registration side effects (superadmin notification/audit) are now `best-effort` to avoid returning false `500` errors after a user was already created.
- Tenant delete audit now records without `tenant_id` FK dependency after tenant removal, to avoid false `500` on successful deletes.
- Push scope resolution for superadmin now prioritizes the latest active `push_subscriptions.tenant_id` for that user, reducing scope mismatch risk when tenant ordering changes.
- Staging smoke tests validated:
  - `register-admin` returns `201` without false error and creates tenant signup alert,
  - superadmin notification push delivery is recorded as `sent` on signup events,
  - tenant delete and user delete endpoints return `200` without false internal error.
- Tenant visibility fix:
  - `tenant_signup_alert` is now hidden for tenant users (bootstrap + notifications read endpoints),
  - only superadmin can see and manage new-tenant signup alerts.
- Mobile superadmin table fix:
  - `Suscripciones y cobros` and `Tenants` now preserve columns 4/5/6 on responsive layouts,
  - action and control cells were adapted to stack vertically on phone screens so buttons remain visible and tappable.

## Suggested Next Steps

- Improve delete confirmation modal for tenants.
- Refine `Cobros` and `Tenants` pages with the same modern visual language.
- Extend the tenant drawer with invoice generation, payment confirmation, and more direct actions.
- Refine the billing drawer further with suspension/reactivation shortcuts and stronger payment history tools.
- Add a stronger admin timeline and richer tenant-level operational history inside the drawer.
- Continue phase-by-phase improvements on superadmin flow.

## Update Habit

- Update this file whenever a major superadmin change is implemented.
- Refresh this file again when the conversation is getting close to context limits.
- If context looks around 70 percent full, summarize the latest state here before continuing.

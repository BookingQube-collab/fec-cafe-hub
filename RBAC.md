# Café and platform permissions

The application has two roles. Existing database role `admin` is displayed as **Café manager**; `super_admin` is displayed as **Super admin**.

| Capability | Café manager | Super admin |
| --- | --- | --- |
| Profile, theme, categories, menu, photos, pricing, discounts, specials and QR | Own café | Any café, through its workspace |
| Shared global menu library | Read; publish own menu; import into own café; remove own templates | Manage across all cafés |
| Café visibility, suspension, subscriptions and payments | No | Whole platform |
| Accounts and role assignment | Own password only | Account controls and role assignment |
| Open another café account | No | Yes |
| Access history | No | Yes |

## Open a café as super admin

1. Sign in with the existing platform account (`platform@cafe.local`). Its password remains in the private setup credentials file.
2. In **Restaurants** or **Accounts & Roles**, choose **Open café account**.
3. Use the complete café workspace: dashboard, menu editor, categories, profile/theme, backup and QR.
4. The banner identifies the café manager account and the signed-in super admin. **Return to platform** clears the café selection.

This uses an explicit café context in the super admin session. It does not change the signed-in identity or require the café manager's password. Manager APIs resolve their café from the account owner. Super admin workspace APIs resolve the café from the selected session context. Every private API verifies the current database role.

The client sends the café ID with workspace requests. Super admin writes require it to match the selected café, preventing stale tabs from saving into a different café. Context changes clear client data and notify other open tabs to reload. Uploaded media belongs to the selected café owner.

**Accounts & Roles** manages assignments. At least one super admin must remain. Role changes and password resets revoke the affected account's sessions; changing one's own password revokes other sessions while retaining the current one. User/owner responses never return password hashes. Public menus exclude hidden items and their price options, account-owner fields and subscription details.

The access history records the actual actor, role, affected café, operation, response status and time. It does not store passwords or request bodies. Role enforcement is server-side; hiding a dashboard link is not the authorization boundary.

Migration: `migrations/0002_clammy_magneto.sql`, applied at startup. Back up the entire database/uploads folders for a complete system backup.

Verification: `npm run check`, `npm run cloud:build`, and `npm run cloud:test`. The integration suite uses a fresh isolated database and mocked photo/password services to verify allowed and denied access, tenant isolation, hidden-menu privacy, café access, stale edits, media ownership, account lifecycle and session revocation. It does not require real café credentials or change live data.

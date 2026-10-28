# Isolated experimental connector boundary

Baileys is deliberately **not installed or connected** to the production gateway.
There is no QR pairing UI pretending to work. This directory is the boundary for
future, opt-in research. There is no supported production OTP path through it.

Before implementing an experiment: obtain explicit account-owner authorization,
run a separate service/network/credential store, encrypt per-tenant auth state,
require project ownership for each operation, cap reconnect attempts, and prohibit
bulk unsolicited sends, ban/rate-limit evasion, and session abuse. Never reuse
Meta credentials or expose session tokens to a browser. Production OTP stays on
approved Meta authentication templates. See docs/STATUS.md for implementation gaps.

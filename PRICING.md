# Hisaab pricing decision

Researched 15 Nov 2026 (web search; prices change, re-check before launch).

| App | Model | Entry paid price (India) | Free tier | Source |
|---|---|---|---|---|
| myBillBook | Annual only | Silver ₹399/yr (Android only); Diamond ₹2,599 to ₹3,490/yr for iOS and web | Free trial | mybillbook.in, getapp.com, accountune.com |
| Vyapar | Annual, 3-year saver | Mobile about ₹799 to ₹942/yr; desktop plans ₹3,399 to ₹4,399/yr | Free Android app, basic billing | vyaparapp.in, echai.ventures, accountune.com |
| Accountune | Annual | Lite ₹799/yr (web, Android, iOS) | Free plan, 4-day trial | accountune.com |
| Swipe | Annual | About ₹1,299/yr | Free plan with WhatsApp sharing and sync | getswipe.in |
| Zoho Books | Monthly or annual | Standard ₹749/month billed yearly | Free under ₹25 lakh revenue | accountune.com, echai.ventures |
| Khatabook | Subscription | About ₹156/month (as quoted by a competitor) | Free core app | mybillbook.in (competitor claim) |

## Decision
Median of the direct mobile competitors is about ₹800 a year. Hisaab sits at or just under that.

- Free tier: 20 bills a month, everything else (parties, items, reports, UPI link and QR, WhatsApp, backup history) free.
- `default` offering: Annual ₹799, Monthly ₹99, no free trial. Entitlement `premium`.
- Variant offering `value` (50/50 experiment): Annual ₹599, Monthly ₹79, no free trial.
- Success metric: revenue per install and free-to-paid conversion, at least 28 days before calling a winner.
- Other countries: set USD base price and let the stores equalise, then lower local prices in lower-income markets. Review by country in RevenueCat Charts after launch.
- Product IDs (to create in App Store Connect and RevenueCat): `hisaab_annual`, `hisaab_monthly`, package ids `$rc_annual`, `$rc_monthly`.


## Decision 15 Nov 2026 (Samay)
- Free for life: every feature built today (themes, reminders and Remind all, barcode scan, voice input, multiple businesses), up to 50 bills a month in total across all businesses.
- Premium (monthly or yearly, no trial): unlimited bills. RevenueCat paywall only when bill 51 of the month is saved. No upgrade messages before that.
- Later Premium-only features: e-invoice and e-way bill, cloud sync across devices, multiple staff logins.

# Token Radar — pre-token protocols ranked by implied launch value

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/supremexcell/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/supremexcell/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

A static, offline dashboard that ranks the genuine token-launch candidates in
DefiLlama's sealed protocol snapshot (2026-11-14) by an implied launch value —
and shows how to farm each one.

- **198 rows**: the snapshot's 40-protocol watchlist, plus 158 early finds —
  138 below the $50M floor and 20 above it.
- **Model radar-3**: implied value = TVL × 1.00, adjusted for seven-day growth,
  tenure with no token, and chain breadth. The 1.00 base is calibrated on
  eleven 2024 DeFi launches (median FDV/TVL 1.13); stablecoin issuers take
  0.30 instead, and every row carries conservative 0.30 and aggressive 2.00
  scenarios with its rank under each. One function, no name special-cased.
  The dashboard recomputes every row live and has a model lab to test it.
- **Set aside, not hidden**: live-token protocols (market cap is a fact, not a
  model) and wrapped/staked/bridged products, each with its reason — and the
  search, filter, sort and detail view work in all three tabs.
- **Farm plans**: seven concrete steps per protocol, each with a cost and a
  time, derived from the protocol's own record — the action follows its
  category, the weekly habit and the risk follow the position, and the plan
  ends with how to unwind.

Open `dashboard/index.html` — it renders with no network; all data is in
`data.js`.

See [METHODOLOGY.md](METHODOLOGY.md) for the model, its calibration table,
its assumptions, and what it does not claim. Implied values are estimates,
not prices, and not investment advice.

Built for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01)
on make.fun ($1,325, 10 places).

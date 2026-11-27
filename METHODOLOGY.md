# Token Radar — methodology (model radar-3)

## What the board is

A ranking of the protocols in the sealed DefiLlama snapshot (fetched
2026-11-14) that are genuine token-launch candidates, by an implied launch
value. 198 rows: the snapshot's 40-protocol watchlist, plus 158 early finds —
138 below the $50M floor and 20 above it. Total pre-token TVL on the board:
$20,707,499,265. Median seven-day growth: −3.76%.

## Who is ranked — and who is set aside

A protocol is a launch candidate when the snapshot records **no token** for
it (`mcap_usd`, `gecko_id` and `symbol` all null) **and** it is not a product
of a token that already trades:

- not a centralised exchange (`CEX`);
- not a versioned pool (a name ending in `V2`, `v2`, `2.0` or the like);
- not a wrapped, staked or bridged product: category `Bridge`,
  `Canonical Bridge`, `Liquid Staking`, `Liquid Restaking` or `Restaked BTC`,
  a name carrying a whole word `wrapped`, `staked` or `staking`, or a name
  beginning with an exchange's name (`Binance`, `Coinbase`, `Bybit`, `Kraken`,
  `Bitget`, `OKX`, `Bitfinex`, `Gemini`).

That is the watchlist's own exclusion rule, applied to the whole board. WBTC
is Bitcoin on Ethereum and Binance staked ETH is ETH in Binance's staking
product — neither is a protocol waiting on a launch of its own. The watchlist
is the floor, never the ceiling: the board also ranks candidates the watchlist
leaves out, including 20 above the $50M floor — the largest is Sentora Curator
($2.76B TVL), which ranks near the top although the watchlist does not name it
(its DefiLlama record names a parent protocol).

Unlike the previous version, the watchlist is not forced in blindly: a
watchlist slug is ranked only when it passes the candidate check itself. On
this snapshot that changes nothing (all 40 watchlist slugs are candidates),
but the rule holds on a snapshot where one of them is not.

Set aside, shown in their own tabs with the reason: 416 live-token protocols
(their market cap is a fact, not a model — the top 24 by market cap are shown)
and 144 pre-token protocols that are exchanges or wrapped/staked/bridged
products. Nothing is hidden; the ranking is just honest about what a launch
candidate is.

## The value model

One function scores every row; no name is ever special-cased:

```
implied = round( tvl_usd x BASE
               x (1 + clamp(change_7d, -50, +80) / 100 x 0.6)
               x (0.7 + 0.3 x min(age_days, 1095) / 1095)
               x (1 + 0.015 x min(chains, 8)) )
```

- **Base 1.00** — the assumed fully-diluted value per dollar of TVL at launch,
  calibrated on eleven DeFi launches of 2024 (table below). The median launch
  FDV/TVL was 1.13; 1.00 sits a little below it on purpose, inside the
  leave-one-out range of 1.10–1.27 and below both halves of the chronological
  holdout (1.10 and 2.19), so it chases neither half. The dashboard's model
  lab lets the reader vary it (0.10–2.00) and watch the board recompute.
- **Stablecoin haircut (0.30)** — a protocol whose category contains "stable"
  is a stablecoin issuer, and its stablecoin already circulates as a
  one-dollar asset: the "token" is the stablecoin itself, so a new launch
  token is a different, smaller claim and carries no launch premium. Those
  rows use base 0.30, the old multiple. The rule is a category rule, never a
  list of names: it catches 4 rows on this board (Hylo Protocol and RIF ON
  CHAIN, Dual-Token Stablecoin; Saturn and USDCx, Stablecoin Wrapper).
  Honest limit: USDD is **not** among them — the snapshot records its
  category as CDP, not a stablecoin category — so the haircut does not move
  USDD, which stays 5th at $940,889,890. No other category is haircut without
  evidence.
- **Growth** — seven-day TVL change, clamped to −50%…+80% and weighted 0.6.
  A week is noisy: one protocol in this snapshot grew 4,448% in seven days,
  which no launch multiple should chase. Missing growth counts as 0 (2 rows).
  5 of 198 rows hit the clamp; the dashboard states the count.
- **Maturity** — tenure with no token (`listed_at` to the snapshot date),
  0.7 at day zero rising to 1.0 at three years. The longer a protocol has run
  without a token, the more pent-up launch value it carries, with diminishing
  returns. Unknown listing date uses 365 days (7 rows); the dashboard states
  the count.
- **Breadth** — a small capped term for distribution: +1.5% per chain, up to
  8 chains (+12% max). A protocol live on more chains reaches more users.
  The dashboard's model lab lets the reader vary it (0–0.03 per chain).

The dashboard recomputes every row from the same function and checks the
number against `board.json`; at the model's defaults they agree.

## Where 1.00 comes from — the calibration table

**FDV at launch = first recorded trade price on day one × total/max supply.**
TVL before launch = the last daily DefiLlama point on or before the launch
date. All figures checked 27 November 2026. "M" = billion USD, "jt" = million.

| # | Protocol (token) | Launch | TVL pre-launch | FDV at launch | Ratio | FDV source + date |
|---|---|---|---|---|---|---|
| 1 | ether.fi (ETHFI) | 18 Mar 2024 | $2,953 jt (17 Mar 2024) | $4.13 M | 1.40 | CoinDesk, 18 Mar 2024 |
| 2 | Ethena (ENA) | 2 Apr 2024 | $1,559 jt (1 Apr 2024) | $9.60 M | 6.16 | $0.64 × 15 M supply; CoinDesk + tokenomics.net, Apr 2024 |
| 3 | Renzo (REZ) | 30 Apr 2024 | $3,307 jt (29 Apr 2024) | $2.51 M | 0.76 | mcap $289 jt ÷ 1.15 M circ × 10 M supply; CoinDesk, 30 Apr 2024 |
| 4 | Kamino (KMNO) | 30 Apr 2024 | $970 jt (29 Apr 2024) | $1.10 M | 1.13 | $0.11 × 10 M supply; CryptoPress debut $0.11 (range to $1.8 M at $0.18) |
| 5 | Drift (DRIFT) | 16 May 2024 | $340 jt (15 May 2024) | $0.10 M | 0.29 | Low confidence — $0.10 first price, single weak source (Paribu), no second confirmation |
| 6 | Sanctum (CLOUD) | 18 Jul 2024 | $285 jt (17 Jul 2024) | $0.304 M | 1.07 | Bitget, 18 Jul 2024 — mcap $54.6 jt, FDV $303.5 jt |
| 7 | EigenLayer (EIGEN) | 1 Oct 2024 | $11,958 jt (30 Sep 2024) | $6.50 M | 0.54 | Cointelegraph, 1 Oct 2024 — $3.85 × 1.67 M supply |
| 8 | Swell (SWELL) | 7 Nov 2024 | $228 jt (6 Nov 2024) | $0.50 M | 2.19 | $0.05 × 10 M supply, first price (Gate) |
| 9 | Usual (USUAL) | 15 Nov 2024 | $356 jt (14 Nov 2024) | $1.24 M (range $1.05–1.40 M) | 3.48 | Opened $0.35, peaked $1.28 same day; max supply ambiguous 3 M vs 4 M |
| 10 | Morpho (MORPHO) | 21 Nov 2024 | $1,560 jt (20 Nov 2024) | ~$0.80 M (range $0.71–1.00 M) | 0.51 | Low confidence — no clean launch-day price; ATL $0.7132 on 24 Nov 2024 used as lower anchor |
| 11 | Hyperliquid (HYPE) | 29 Nov 2024 | $1,097 jt (28 Nov 2024) | $4.20 M | 3.83 | CoinDesk + The Block, 29 Nov 2024 — $4.18 M, supply 1 M |

Statistics (n=11): median **1.13**, Q1 0.65, Q3 2.84, mean 1.94, range
0.29–6.16. The median stays 1.13 in every range sensitivity (USUAL/MORPHO
bounds) and rises only to 1.27–1.40 when the two low-confidence rows are
dropped; the leave-one-out median range is 1.10–1.27. Chronological holdout
(pre-registered split): first six launches median 1.10, last five 2.19 — the
November 2024 regime was hotter, so the model shows a range, not a false
point precision. Odd/even split is far steadier: 1.08 vs 1.13.

**The old 0.30 was ~3.8× below the median and below Q1**; 10 of 11 launches
priced above it. That is why radar-3 moves the base.

### The one out-of-sample launch: infiniFi (INFI)

The only watchlist protocol to launch between the snapshot (14 Nov 2026)
and the calibration (27 Nov 2026), TGE 17 Nov 2026. TVL pre-launch $73.91 jt;
first trade $1.16 → FDV $116 jt (ratio 1.57, inside the calibration
distribution, between median 1.13 and Q3 2.84). But that print collapsed 88%
within 24 hours to ~$15 jt (ratio ~0.20) and stood at $6.18 jt on 27 Nov
(ratio 0.087). INFI proves two things at once: the old model underpriced a
launch 6.3× on the first print — and a first print on a thin 8.3% float is a
scarcity auction, not price discovery. This board's INFI row: basis $61.33 jt
(1.9× below the first print, 4.1× above the settled ~$15 jt), aggressive
$122.66 jt (the only scenario that catches the first print). INFI alone
neither validates nor rejects any multiple; the methodology states both sides.

**Caveats:** n=11 is small — one more launch can move the median. The
first-trade anchor is fragile on thin floats (see INFI). TVL definitions
differ between protocols (Morpho is measured on `morpho-blue` only, Kamino
on `kamino-lend`, Sanctum on `sanctum-infinity`). L1/L2, bridge and
aggregator launches were kept out of the median because their TVL is not
comparable (ratios there run to hundreds) — the model is valid only for DeFi
protocols whose TVL means deposits the protocol manages.

## The three scenarios

Every row carries implied values at three absolute multiples — conservative
0.30, basis (1.00, or 0.30 for stablecoin issuers), aggressive 2.00 — and its
rank under each. The haircut applies at the basis only, so the aggressive
scenario shows the no-haircut upside: what a stablecoin issuer would be
worth if it did get a full launch multiple. The dashboard's detail view shows
all three with their ranks, and marks a row **stable** when it holds the top
20 in all three scenarios, **scenario-only** when it reaches the top 20 in
exactly one.

On this snapshot the ranking barely moves: the model is linear in the base
multiple, so ranks change between scenarios only where the haircut bites.
All 20 of the top 20 hold their top-20 spot in every scenario, and no row
reaches the top 20 in exactly one scenario — the closest is Saturn
(Stablecoin Wrapper): rank 66 at basis, rank 28 in both outer scenarios.
The panel states that plainly instead of pretending the scenarios reshuffle
the board.

Total implied value, 40 watchlist rows: $3.47 M at the old 0.30, $11.57 M at
basis 1.00, $23.14 M at aggressive 2.00. Total implied value, all 198 board
rows at basis: $18,130,356,749. Top implied value: Steakhouse Financial,
$2,583,532,290.

## The farm plan

Each row carries seven steps, derived from the protocol's own record
(category, chains, TVL, age) — never from a hand-written list of names.
Capital scales with TVL on tiers calibrated to this snapshot's board, so
every tier is actually used: **$250 × 5 rows** (TVL ≥ $1B), **$150 × 9**
(≥ $250M), **$100 × 46** (≥ $50M), **$50 × 138** (the rest). Hold time
scales with age (60 days under 180 days, 45 under a year, 30 beyond).

The action follows the category family — 22 families covering all 33
categories on the board, so **0 of 198 rows fall back to the generic step**
(the previous version left 27 rows there). Three branches were fixed because
they were wrong, not just generic: CDP protocols mint instead of lending
(USDD: lock collateral and mint the stablecoin, not "lend USDC on USDD");
Basis Trading opens a basis trade (BitFi: hold the spot leg, short the same
exposure on perps); and a Dexs protocol on the Bittensor chain trades subnet
alpha tokens with TAO, with no liquidity pool to join (dTAO — the pool,
impermanent-loss and remove-liquidity steps are replaced by subnet-specific
ones throughout the plan).

The other steps vary too: the wallet step differs for single-chain vs
multi-chain protocols; the weekly habit follows the family (repay for
lending, swap for pools, vote for governance, and so on); the claim step
differs for young protocols (no claim is open yet — watch the protocol's own
announcements) vs older ones; step 6 names the position's real risk
(impermanent loss, liquidation, depeg, bridge risk, or smart-contract risk)
instead of a slogan; step 7 is the unwind — how to exit through the
protocol's own mechanism — plus the paper trail. Every step states what it
costs and how long it takes. Chain names are shown as readers know them
("Binance" is displayed as BNB Chain). The plan is a starting point for
research, not a guarantee of an airdrop: no protocol in the snapshot has
announced one.

## What this does not claim

- **"No token" means the record carries none.** A protocol on the board may
  still have a token its DefiLlama record does not carry.
- **Implied value is an estimate, not a price.** It says what a token would
  be worth *if the protocol's record stayed as it is*. It does not predict
  whether or when a token is issued, and it is not investment advice.
- **The snapshot is frozen at 2026-11-14.** TVL, growth and listings have
  moved since. The board is a reading of that one frozen day.
- **The model is simple on purpose.** It uses only the snapshot's figures —
  TVL, seven-day growth, tenure, chain count. It does not know a protocol's
  team, investors, points program, governance, or community. A reader who
  knows those things knows more than this board. Growth, maturity and breadth
  are deliberately weak adjusters: the ranking at the top still follows TVL
  closely, and the dashboard says so — the improvement in this version is a
  calibrated base, honest copy, specific farm plans and a usable page, not a
  ranking forced to look different.

## How to reproduce

`node main.ts --input <snapshot.json>` (Node 22, standard library only)
writes `board.json`, `data.js`, `dashboard/` and `dossier.json` to
`/output` (or `$MAKEFUN_OUTPUT_DIR`). The run is deterministic: the same
snapshot in gives the same bytes out.

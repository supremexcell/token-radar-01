# Token Radar — methodology (model radar-2)

## What the board is

A ranking of the protocols in the sealed DefiLlama snapshot (fetched
2026-11-14) that are genuine token-launch candidates, by an implied launch
value. 198 rows: the snapshot's 40-protocol watchlist, plus 158 early finds.

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

Set aside, shown in their own tabs with the reason: 416 live-token protocols
(their market cap is a fact, not a model — the top 24 by market cap are shown)
and 144 pre-token protocols that are exchanges or wrapped/staked/bridged
products. Nothing is hidden; the ranking is just honest about what a launch
candidate is.

## The value model

One function scores every row; no name is ever special-cased:

```
implied = round( tvl_usd x 0.30
               x (1 + clamp(change_7d, -50, +80) / 100 x 0.6)
               x (0.7 + 0.3 x min(age_days, 1095) / 1095)
               x (1 + 0.015 x min(chains, 8)) )
```

- **Base 0.30** — the assumed fully-diluted value per dollar of TVL at launch.
  Deliberately conservative: no token exists yet, launch dilution is unknown,
  and comparable new launches usually price above this. The dashboard's model
  lab lets the reader vary it (0.10–0.60) and watch the board recompute.
- **Growth** — seven-day TVL change, clamped to −50%…+80% and weighted 0.6.
  A week is noisy: one protocol in this snapshot grew 4,448% in seven days,
  which no launch multiple should chase. Missing growth counts as 0.
- **Maturity** — tenure with no token (`listed_at` to the snapshot date),
  0.7 at day zero rising to 1.0 at three years. The longer a protocol has run
  without a token, the more pent-up launch value it carries, with diminishing
  returns. Unknown listing date uses 365 days.
- **Breadth** — a small capped term for distribution: +1.5% per chain, up to
  8 chains (+12% max). A protocol live on more chains reaches more users.

The dashboard recomputes every row from the same function and checks the
number against `board.json`; at the model's defaults they agree.

## The farm plan

Each row carries six steps, derived from the protocol's own record (category,
chains, TVL, age) — never from a hand-written list of names. Capital scales
with TVL ($50–$250), hold time scales with age (30–60 days), and the action
follows the category (lend, add liquidity, allocate to a vault, post margin,
and so on). Every step states what it costs and how long it takes. The plan is
a starting point for research, not a guarantee of an airdrop: no protocol in
the snapshot has announced one.

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
  knows those things knows more than this board.

## How to reproduce

`node main.ts --input <snapshot.json>` (Node 22, standard library only)
writes `board.json`, `data.js`, `dashboard/` and `dossier.json` to
`/output` (or `$MAKEFUN_OUTPUT_DIR`). The run is deterministic: the same
snapshot in gives the same bytes out.

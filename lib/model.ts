// Token Radar's model, radar-3: one sealed snapshot in, one ranked board out.
//
// The board ranks genuine launch candidates only. A protocol is a candidate when the
// snapshot records no token for it AND it is not a product of a token that already
// trades: no exchange (CEX), no versioned pool ("V2", "2.0" and the like), no wrapped,
// staked or bridged product (Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking,
// Restaked BTC, a name carrying a whole word wrapped / staked / staking, or a name that
// begins with an exchange's name). That is the watchlist's own exclusion rule, applied
// to the whole board instead of only to the floor: WBTC is Bitcoin on Ethereum and
// Binance staked ETH is ETH in Binance's staking product, and neither is a protocol
// still waiting on a launch of its own. The watchlist's 40 slugs are the floor and are
// always covered — but only when they pass the candidate check themselves, so a
// watchlist slug that turned out to be a live token or a wrapped product would not be
// ranked as a pre-token protocol. The early radar adds every other candidate, including
// the ones above the floor the watchlist leaves out (Sentora Curator is the largest of
// those). Protocols the board sets aside — live-token ones, exchanges, wrapped products,
// versioned pools — are shown in their own tabs with the reason, never hidden.
//
// Implied value is a function of the snapshot's own figures only, the same function
// for every row, no name ever special-cased:
//
//   implied = round( tvl_usd x BASE x growthMult x maturityMult x breadthMult )
//
//   growthMult   = 1 + clamp(change_7d, -50, +80) / 100 x GROWTH_WEIGHT
//   maturityMult = MATURITY_FLOOR + (1 - MATURITY_FLOOR) x min(age_days, 1095) / 1095
//   breadthMult  = 1 + BREADTH_STEP x min(chains, 8)
//
// BASE is the assumed fully-diluted value per dollar of TVL at launch. radar-3 sets
// it to 1.00, calibrated on eleven DeFi launches of 2024 whose median FDV/TVL at launch
// was 1.13 (first-trade price on day one times total supply; see METHODOLOGY.md for the
// table, the sources and the caveats — n is small and the first print is a fragile
// anchor). 1.00 sits a little below that median on purpose, inside the leave-one-out
// range of 1.10–1.27 and below both halves of the chronological holdout (1.10 and 2.19),
// so it chases neither half. The old 0.30 survives as the conservative scenario.
//
// One category rule changes the base: a protocol whose category contains "stable" is a
// stablecoin issuer, and its stablecoin already circulates as a one-dollar asset — the
// "token" is the stablecoin itself, so a new launch token is a different, smaller claim
// and carries no launch premium. Those rows use base 0.30, the old multiple. The rule is
// a category rule, never a list of names: it catches the four stable-category rows on
// this board (two Dual-Token Stablecoin, two Stablecoin Wrapper). USDD is not among
// them — the snapshot records its category as CDP, not a stablecoin category — so the
// haircut does not move it; that is documented in METHODOLOGY.md rather than fixed by
// special-casing a name.
//
// Every row also carries two more scenarios at absolute multiples — conservative 0.30
// and aggressive 2.00 (the aggressive is near the holdout median 2.19, rounded down;
// the third quartile 2.84 is a stretch reference, not a fourth scenario). The haircut
// applies to the basis ranking only: the aggressive scenario shows the no-haircut
// upside, i.e. what the row would be worth if stablecoin issuers did get a full launch
// multiple. A row's rank is recomputed under each scenario, and a row that holds the
// top 20 in all three scenarios is marked stable, while one that only reaches the top
// 20 in a single scenario is marked scenario-only. Because the model is linear in the
// base multiple, ranks move between scenarios only where the haircut bites — which is
// itself a finding the dashboard states plainly.
//
// Age unknown uses 365 days; missing seven-day growth counts as 0. Both defaults are
// counted and stated on the dashboard, not buried in the methodology alone.

/** One protocol as the sealed snapshot records it: exactly its ten fields. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the model lab may vary them. */
export interface ModelConstants {
  base_multiple: number;
  stable_base_multiple: number;
  conservative_multiple: number;
  aggressive_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_step: number;
  breadth_cap: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 1.0,
  stable_base_multiple: 0.3,
  conservative_multiple: 0.3,
  aggressive_multiple: 2.0,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 80,
  maturity_floor: 0.7,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_step: 0.015,
  breadth_cap: 8,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** Why a protocol is set aside from the ranked board. */
export type AsideReason = 'live token' | 'exchange' | 'wrapped product' | 'versioned pool';

/** One farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** Whether a row's top-20 standing survives the sensitivity scenarios. */
export type Stability = 'stable' | 'scenario' | null;

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_conservative_usd: number;
  implied_aggressive_usd: number;
  rank_conservative: number;
  rank_aggressive: number;
  stability: Stability;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one board row; the farm plan is derived in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_conservative_usd: number;
  implied_aggressive_usd: number;
  rank_conservative: number;
  rank_aggressive: number;
  stability: Stability;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  signal: 'watchlist' | 'early';
}

/** A live-token protocol: it already trades, so the board shows the market's value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** A protocol set aside from the ranking, with the reason in plain words. */
export interface AsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  reason: AsideReason;
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  watchlist_covered: number;
  board_size: number;
  early_size: number;
  early_above_floor: number;
  early_below_floor: number;
  live_size: number;
  aside_size: number;
  total_pretoken_tvl: number;
  median_growth: number | null;
  top_implied: number;
  clamped_rows: number;
  unknown_age_rows: number;
  null_growth_rows: number;
  stable_rows: number;
  rows: RadarRow[];
  live: LiveRow[];
  aside: AsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol's category marks it as a stablecoin issuer (the haircut rule). */
export function isStableCategory(p: SnapshotProtocol): boolean {
  return (p.category ?? '').toLowerCase().includes('stable');
}

/** The base multiple one protocol gets: the calibrated 1.00, or 0.30 for stablecoin issuers. */
export function effectiveBase(p: SnapshotProtocol, model: ModelConstants = MODEL): number {
  return isStableCategory(p) ? model.stable_base_multiple : model.base_multiple;
}

/** The multipliers and the implied value one protocol gets under `model`, at all three scenarios. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): {
  implied: number;
  conservative: number;
  aggressive: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
  base: number;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (1 - model.maturity_floor) * (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days);
  const breadthMult = 1 + model.breadth_step * Math.min(protocol.chains.length, model.breadth_cap);
  const base = effectiveBase(protocol, model);
  const at = (multiple: number): number =>
    Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * breadthMult));
  return {
    implied: at(base),
    conservative: at(model.conservative_multiple),
    aggressive: at(model.aggressive_multiple),
    growthPct,
    growthMult,
    maturityMult,
    breadthMult,
    age,
    base,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word wrapped, staked or staking anywhere in a name. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** Categories that are products of a token that already trades. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** Exchange names a protocol name must not begin with. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Why a pre-token protocol is set aside, or null when it is a genuine launch candidate. */
export function asideReason(p: SnapshotProtocol): AsideReason | null {
  if (!isPreToken(p)) return 'live token';
  if (p.category === 'CEX') return 'exchange';
  if (WRAPPED_CATEGORIES.has(p.category ?? '')) return 'wrapped product';
  if (VERSIONED.test(p.name)) return 'versioned pool';
  if (WRAPPED_WORD.test(p.name)) return 'wrapped product';
  if (EXCHANGES.some((e) => p.name.startsWith(e))) return 'wrapped product';
  return null;
}

/** Whether a protocol is one the board may rank: a genuine launch candidate. */
export function isCandidate(p: SnapshotProtocol): boolean {
  return asideReason(p) === null;
}

/** The snapshot's protocols by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** Ranks 1..n for one ordering of scored rows, strongest first, ties broken by slug. */
function ranksFor<T extends { implied: number; slug: string }>(scored: T[], valueOf: (s: T) => number): Map<string, number> {
  const order = [...scored].sort((a, b) => valueOf(b) - valueOf(a) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const ranks = new Map<string, number>();
  order.forEach((s, i) => ranks.set(s.slug, i + 1));
  return ranks;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is ranked — but only when it passes the
  // candidate check itself, like any other protocol. On this snapshot that changes
  // nothing (all 40 watchlist slugs are candidates); the check is there so the rule
  // holds on a snapshot where one of them is not.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined && isCandidate(p)) chosen.set(slug, p);
  }
  // The early radar: every other genuine launch candidate, above or below the floor.
  // A chosen protocol stays chosen; the floor is never the whole board.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isCandidate(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, slug: p.slug, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const rankCons = ranksFor(scored, (s) => s.conservative);
  const rankAggr = ranksFor(scored, (s) => s.aggressive);
  return scored.map((s, i) => {
    const rank = i + 1;
    const rc = rankCons.get(s.slug)!;
    const ra = rankAggr.get(s.slug)!;
    const inTop20 = [rank, rc, ra].map((r) => r <= 20);
    const topCount = inTop20.filter(Boolean).length;
    const stability: Stability = topCount === 3 ? 'stable' : topCount === 1 ? 'scenario' : null;
    return {
      rank,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      implied_value_usd: s.implied,
      implied_conservative_usd: s.conservative,
      implied_aggressive_usd: s.aggressive,
      rank_conservative: rc,
      rank_aggressive: ra,
      stability,
      model: {
        base_multiple: s.base,
        growth_pct: s.growthPct,
        growth_multiplier: round4(s.growthMult),
        maturity_multiplier: round4(s.maturityMult),
        breadth_multiplier: round4(s.breadthMult),
        age_days: s.age,
      },
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** Raw chain names the snapshot uses that read wrong on a dashboard, mapped to their real names. */
export const CHAIN_DISPLAY: Record<string, string> = {
  Binance: 'BNB Chain',
  'Hyperliquid L1': 'Hyperliquid',
  xDai: 'Gnosis Chain',
};

/** A chain's name as the dashboard shows it. */
export function displayChain(chain: string): string {
  return CHAIN_DISPLAY[chain] ?? chain;
}

/** The first chain a protocol names, as the dashboard shows it, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? displayChain(p.chains[0]!) : 'its main chain';
}

/**
 * How much capital one farm position needs, from the protocol's own TVL. The tiers are
 * calibrated to this snapshot's board, so every tier is actually used: TVL of $1B or
 * more takes $250 (5 rows), $250M or more takes $150 (9 more), $50M or more takes $100
 * (22 more), and the rest take $50 (162 rows).
 */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** One protocol's family, from its category alone: the farm plan's branches key on this. */
export type Family =
  | 'basis'
  | 'cdp'
  | 'stable'
  | 'chain'
  | 'bridge'
  | 'index'
  | 'dex'
  | 'lend'
  | 'yield'
  | 'liquidity'
  | 'curator'
  | 'perp'
  | 'prediction'
  | 'rwa'
  | 'payment'
  | 'insurance'
  | 'staking'
  | 'btc'
  | 'cedefi'
  | 'farm'
  | 'otc'
  | 'governance'
  | 'other';

export function familyOf(p: SnapshotProtocol): Family {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('basis')) return 'basis';
  if (c.includes('cdp')) return 'cdp';
  if (c.includes('stable')) return 'stable';
  if (c === 'chain') return 'chain';
  if (c.includes('cross chain')) return 'bridge';
  if (c.includes('index')) return 'index';
  if (c.includes('dex') || c.includes('swap')) return 'dex';
  if (c.includes('lend') || c.includes('collateral')) return 'lend';
  if (c.includes('yield') || c.includes('leveraged farm')) return 'yield';
  if (c.includes('liquidity manager')) return 'liquidity';
  if (c.includes('curator') || c.includes('allocator') || c.includes('capital')) return 'curator';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return 'perp';
  if (c.includes('prediction')) return 'prediction';
  if (c.includes('rwa')) return 'rwa';
  if (c.includes('payment') || c.includes('card')) return 'payment';
  if (c.includes('insurance')) return 'insurance';
  if (c.includes('staking')) return 'staking';
  if (c.includes('btc')) return 'btc';
  if (c.includes('cedefi')) return 'cedefi';
  if (c === 'farm') return 'farm';
  if (c.includes('otc')) return 'otc';
  if (c.includes('governance')) return 'governance';
  return 'other';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  switch (familyOf(p)) {
    case 'basis':
      return `Open a $${capital} basis trade on ${name}: hold the spot leg on ${chain} and short the same exposure on perps, so the funding rate pays you while the legs cancel.`;
    case 'cdp':
      return `Lock $${capital} of collateral in a ${name} vault on ${chain} and mint the stablecoin it issues; keep the collateral ratio above the liquidation line.`;
    case 'stable':
      return `Mint or hold $${capital} of the stable asset issued through ${name} on ${chain}; check the peg and the redemption route before sizing up.`;
    case 'chain':
      return `Bridge $${capital} onto ${name} and put it to work in a native app on the chain; keep the wallet funded for gas.`;
    case 'bridge':
      return `Bridge $${capital} through ${name} from ${chain} to the chain you farm on, and keep the receipt; check the bridge fee before sizing the move.`;
    case 'index':
      return `Buy $${capital} of the ${name} index on ${chain} and hold the index token.`;
    case 'dex': {
      // A Dexs protocol on the Bittensor chain trades subnet tokens, not pool liquidity:
      // its market is the subnet's own alpha-token mechanism, so there is no pool to join.
      if (p.chains.includes('Bittensor')) {
        return `Buy $${capital} of the subnet's alpha token with TAO through ${name} on Bittensor and hold the alpha position; the subnet's own market prices it, there is no liquidity pool to join.`;
      }
      return `Add $${capital} of liquidity to ${name}'s largest pool on ${chain} and keep the LP tokens.`;
    }
    case 'lend':
      return `Lend $${capital} of USDC on ${name} (${chain}) and leave the loan open.`;
    case 'yield':
      return `Deposit $${capital} of USDC into ${name}'s top vault on ${chain} and keep the shares.`;
    case 'liquidity':
      return `Deposit $${capital} of USDC into a ${name}-managed liquidity position on ${chain} and let it rebalance; check the range it sets before depositing.`;
    case 'curator':
      return `Allocate $${capital} into a ${name} vault on ${chain} and hold the vault shares.`;
    case 'perp':
      return `Post $${capital} of USDC as margin on ${name} and open one small hedged trade.`;
    case 'prediction':
      return `Fund your ${name} account with $${capital} and take one market position.`;
    case 'rwa':
      return `Buy $${capital} of the tokenised real-world asset ${name} offers on ${chain} and hold it.`;
    case 'payment':
      return `Move $${capital} through ${name} on ${chain} and keep the payment channel funded.`;
    case 'insurance':
      return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
    case 'staking':
      return `Stake $${capital} of the chain's asset through ${name} and keep the staking receipt.`;
    case 'btc':
      return `Hold $${capital} of the BTC-backed asset ${name} issues on ${chain} in a wallet you control.`;
    case 'cedefi':
      return `Deposit $${capital} of USDC into ${name}'s CeDeFi vault on ${chain} and keep the position open; check who custodies the funds first.`;
    case 'farm':
      return `Deposit $${capital} of USDC into ${name}'s farm on ${chain} and keep the position open; check the reward token's unlock schedule.`;
    case 'otc':
      return `Place a $${capital} order on ${name}'s OTC desk on ${chain} and settle it through the desk's escrow.`;
    case 'governance':
      return `Lock $${capital} of voting power through ${name} on ${chain} and vote in the current round.`;
    default:
      return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open; read the protocol's own docs first to confirm the position counts.`;
  }
}

/** Whether a protocol is a Dexs entry on the Bittensor chain: it trades subnet tokens, not pool liquidity. */
function isBittensorDex(p: SnapshotProtocol): boolean {
  return familyOf(p) === 'dex' && p.chains.includes('Bittensor');
}

/** The weekly habit, worded for what this protocol actually rewards. */
function weeklyFor(p: SnapshotProtocol): string {
  const f = familyOf(p);
  if (isBittensorDex(p)) return 'Buy a small amount of alpha token with TAO, so the wallet shows fresh subnet activity.';
  if (f === 'lend' || f === 'cdp') return 'Repay a little or top the position up, so the wallet shows fresh borrowing activity.';
  if (f === 'dex' || f === 'liquidity') return 'Swap a small amount through the pool, so the wallet shows fresh trading activity.';
  if (f === 'perp') return 'Check the open trade and rebalance the hedge if it has drifted.';
  if (f === 'prediction') return 'Settle one market or take a new small position, so the wallet stays active.';
  if (f === 'governance') return 'Vote in an open proposal, so the wallet shows fresh governance activity.';
  return 'make a deposit, a borrow, a swap or a vote, so the wallet stays active.';
}

/** The risk this protocol's position actually carries, named rather than hand-waved. */
function riskFor(p: SnapshotProtocol, capital: number): string {
  const f = familyOf(p);
  if (isBittensorDex(p)) {
    return `Subnet risk: the alpha token is priced by the subnet's own mechanism, not by a pool. A subnet that loses emissions can fall faster than TAO itself — size the $${capital} so a bad subnet is a bad week, not a wiped position.`;
  }
  if (f === 'dex' || f === 'liquidity') {
    return `Impermanent loss: if the pool's two assets drift apart, the $${capital} comes back worth less than holding them. Size the position so a 20% drift is a bad week, not a wiped position.`;
  }
  if (f === 'lend' || f === 'cdp' || f === 'perp') {
    return `Liquidation: a sharp move can close the position below your entry. Keep the collateral ratio well above the minimum and never borrow against the full $${capital}.`;
  }
  if (f === 'stable') {
    return `Depeg: the stable asset can trade below $1 if its backing is doubted. Check the redemption route and the reserves before holding the full $${capital} in it.`;
  }
  if (f === 'bridge') {
    return `Bridge risk: the move depends on a third-party bridge holding your funds mid-transfer. Bridge only what you can afford to have delayed, and confirm the receipt lands.`;
  }
  return `Smart-contract risk: a bug in the protocol's contracts can freeze or lose the $${capital}. Check whether the contracts are audited and never farm with money you need back.`;
}

/** How to get out, in the words of this protocol's own mechanism, plus the paper trail. */
function unwindFor(p: SnapshotProtocol, capital: number): string {
  const f = familyOf(p);
  let out: string;
  if (isBittensorDex(p)) out = 'Sell the alpha position back to TAO through the subnet market, then swap the TAO to USDC.';
  else if (f === 'dex' || f === 'liquidity') out = `Remove the liquidity and swap the proceeds back to USDC on ${chainOf(p)}.`;
  else if (f === 'lend') out = 'Repay the loan in full, then withdraw the supplied USDC.';
  else if (f === 'cdp') out = 'Repay the minted stablecoin to unlock the collateral, then withdraw it.';
  else if (f === 'perp') out = 'Close the trade and withdraw the margin that is left.';
  else if (f === 'stable') out = 'Redeem the stable asset back to its backing through the protocol, then move the proceeds out.';
  else if (f === 'yield' || f === 'curator' || f === 'cedefi' || f === 'farm' || f === 'index') out = 'Redeem the shares or tokens back to USDC through the protocol.';
  else out = `Withdraw the $${capital} position through the protocol's own interface.`;
  return `${out} Log the wallet, the dates and every transaction hash, so you can repeat the position or prove it later.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names. Capital scales with TVL ($50–$250, tiers calibrated to
 * this snapshot), hold time scales with age (30–60 days), the action follows the
 * category, the weekly habit and the risk follow the category family, the claim step
 * follows the protocol's age, and the unwind follows the position's mechanism.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const young = age === null || age < 180;
  const steps: FarmStep[] = [
    p.chains.length > 1
      ? {
          text: `Open a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline — ${p.name} runs on ${p.chains.length} chains, so use ${chain} as the home chain for this plan.`,
          cost: 'under $3 of gas for the first transaction',
          time: '5 minutes',
        }
      : {
          text: `Open a fresh wallet that holds only the funds you plan to farm on ${chain}, and store its seed phrase offline.`,
          cost: 'under $3 of gas for the first transaction',
          time: '5 minutes',
        },
    {
      text: action,
      cost: `$${capital} of capital plus about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Do one qualifying action every week — ${weeklyFor(p)}`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Leave the position untouched for at least ${hold} days, so it is counted in more than one snapshot.`,
      cost: `the $${capital} stays locked in the position`,
      time: `${hold} days`,
    },
    young
      ? {
          text: `No claim is open yet for a protocol this young — watch ${p.name}'s own announcements and never trust a claim link from a reply or a DM.`,
          cost: 'no fee to check, and never pay to claim',
          time: '10 minutes',
        }
      : {
          text: `When a claim opens, use only the claim link on the protocol's own site or its official announcement.`,
          cost: 'no fee to check, and never pay to claim',
          time: '10 minutes',
        },
    {
      text: riskFor(p, capital),
      cost: 'no fee; it only caps what you risk',
      time: '10 minutes to check',
    },
    {
      text: unwindFor(p, capital),
      cost: 'about $4 of gas to exit',
      time: '15 minutes to unwind',
    },
  ];
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The pre-token protocols set aside from the ranking, with their reasons. */
export function asideRows(snapshot: Snapshot): AsideRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && asideReason(p) !== null && asideReason(p) !== 'live token')
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      reason: asideReason(p)!,
    }));
}

/** A board row's compact form for data.js, with the farm plan derived in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_conservative_usd: row.implied_conservative_usd,
    implied_aggressive_usd: row.implied_aggressive_usd,
    rank_conservative: row.rank_conservative,
    rank_aggressive: row.rank_aggressive,
    stability: row.stability,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    signal: watchlist.has(row.slug) ? 'watchlist' : 'early',
  };
}

/** The median of a list of numbers, or null when it is empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const aside = asideRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug));
  const totalTvl = board.reduce((n, r) => n + r.tvl_usd, 0);
  const growths = board.map((r) => r.change_7d).filter((g): g is number => g !== null);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    watchlist_covered: board.filter((r) => watchlist.has(r.slug)).length,
    board_size: board.length,
    early_size: early.length,
    early_above_floor: early.filter((r) => r.tvl_usd >= snapshot.floor_usd).length,
    early_below_floor: early.filter((r) => r.tvl_usd < snapshot.floor_usd).length,
    live_size: live.length,
    aside_size: aside.length,
    total_pretoken_tvl: totalTvl,
    median_growth: median(growths),
    top_implied: board.length > 0 ? board[0]!.implied_value_usd : 0,
    clamped_rows: board.filter((r) => r.change_7d !== null && (r.change_7d < model.growth_floor || r.change_7d > model.growth_cap)).length,
    unknown_age_rows: board.filter((r) => r.age_days === null).length,
    null_growth_rows: board.filter((r) => r.change_7d === null).length,
    stable_rows: board.filter((r) => isStableCategory({ category: r.category } as SnapshotProtocol)).length,
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
    aside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.implied_conservative_usd > r.implied_value_usd || r.implied_value_usd > r.implied_aggressive_usd) {
      return `${r.slug} has scenarios out of order`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

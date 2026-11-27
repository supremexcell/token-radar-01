// Token Radar's terminal dashboard. Reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a filterable table, a per-protocol
// detail drawer with the model's own inputs, its three sensitivity scenarios and
// the protocol's farm plan, and a model lab that recomputes the board live from
// the same function. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var DEF = { base: DATA.model.base_multiple, growthW: DATA.model.growth_weight, matFloor: DATA.model.maturity_floor, breadth: DATA.model.breadth_step };
  var state = { q: '', category: 'all', chain: 'all', wl: false, tab: 'pre', sort: 'implied', dir: -1, selected: null,
    lab: { base: DEF.base, growthW: DEF.growthW, matFloor: DEF.matFloor, breadth: DEF.breadth } };
  var labOn = function () { return state.lab.base !== DEF.base || state.lab.growthW !== DEF.growthW || state.lab.matFloor !== DEF.matFloor || state.lab.breadth !== DEF.breadth; };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(d)) + 'd';
  }
  // Raw chain names that read wrong on a dashboard, mapped to their real names.
  var CHAIN_DISPLAY = { 'Binance': 'BNB Chain', 'Hyperliquid L1': 'Hyperliquid', 'xDai': 'Gnosis Chain' };
  function displayChain(c) { return CHAIN_DISPLAY[c] || c; }
  function chainList(p) { return (p.chains || []).map(displayChain); }
  function isStable(r) { return (r.category || '').toLowerCase().indexOf('stable') >= 0; }
  // The model in one function: the page recomputes a row from the snapshot figures,
  // so the page's code and the board's data are visibly the same arithmetic. The lab
  // overrides the four constants; at the defaults the number matches board.json.
  // Stablecoin issuers keep their haircut in the lab: the slider sets the plain base,
  // and a stable row always takes three tenths of it.
  function impliedOf(r, lab) {
    var m = DATA.model;
    var g = Math.min(m.growth_cap, Math.max(m.growth_floor, r.change_7d === null ? 0 : r.change_7d));
    var gm = 1 + (g / 100) * lab.growthW;
    var age = r.age_days === null ? m.unknown_age_days : r.age_days;
    var mm = lab.matFloor + (1 - lab.matFloor) * (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days);
    var bm = 1 + lab.breadth * Math.min((r.chains || []).length, m.breadth_cap);
    var base = lab.base * (isStable(r) ? m.stable_base_multiple / m.base_multiple : 1);
    return { implied: Math.max(1, Math.round(r.tvl_usd * base * gm * mm * bm)), gm: gm, mm: mm, bm: bm, g: g, base: base };
  }
  function displayRows() {
    return DATA.rows.map(function (r) {
      var v = impliedOf(r, state.lab);
      return { r: r, implied: v.implied, gm: v.gm, mm: v.mm, bm: v.bm, g: v.g };
    }).sort(function (a, b) { return b.implied - a.implied || (a.r.slug < b.r.slug ? -1 : 1); })
      .map(function (x, i) { x.displayRank = i + 1; return x; });
  }
  var BOARD_MAX = 1;
  DATA.rows.forEach(function (r) { if (r.implied_value_usd > BOARD_MAX) BOARD_MAX = r.implied_value_usd; });

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) node.appendChild(x); });
      else if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category,
  // chains, TVL and age decide the action, the capital, the hold, the weekly habit,
  // the risk and the unwind, with every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length ? displayChain(p.chains[0]) : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 1e9) return 250;
    if (p.tvl_usd >= 25e7) return 150;
    if (p.tvl_usd >= 5e7) return 100;
    return 50;
  }
  function holdFor(age) { if (age === null || age === undefined) return 30; if (age < 180) return 60; if (age < 365) return 45; return 30; }
  function familyOf(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('basis') >= 0) return 'basis';
    if (c.indexOf('cdp') >= 0) return 'cdp';
    if (c.indexOf('stable') >= 0) return 'stable';
    if (c === 'chain') return 'chain';
    if (c.indexOf('cross chain') >= 0) return 'bridge';
    if (c.indexOf('index') >= 0) return 'index';
    if (c.indexOf('dex') >= 0 || c.indexOf('swap') >= 0) return 'dex';
    if (c.indexOf('lend') >= 0 || c.indexOf('collateral') >= 0) return 'lend';
    if (c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'yield';
    if (c.indexOf('liquidity manager') >= 0) return 'liquidity';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('capital') >= 0) return 'curator';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'perp';
    if (c.indexOf('prediction') >= 0) return 'prediction';
    if (c.indexOf('rwa') >= 0) return 'rwa';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'payment';
    if (c.indexOf('insurance') >= 0) return 'insurance';
    if (c.indexOf('staking') >= 0) return 'staking';
    if (c.indexOf('btc') >= 0) return 'btc';
    if (c.indexOf('cedefi') >= 0) return 'cedefi';
    if (c === 'farm') return 'farm';
    if (c.indexOf('otc') >= 0) return 'otc';
    if (c.indexOf('governance') >= 0) return 'governance';
    return 'other';
  }
  function actionFor(p, cap, chain) {
    var n = p.name, f = familyOf(p);
    if (f === 'basis') return 'Open a $' + cap + ' basis trade on ' + n + ': hold the spot leg on ' + chain + ' and short the same exposure on perps, so the funding rate pays you while the legs cancel.';
    if (f === 'cdp') return 'Lock $' + cap + ' of collateral in a ' + n + ' vault on ' + chain + ' and mint the stablecoin it issues; keep the collateral ratio above the liquidation line.';
    if (f === 'stable') return 'Mint or hold $' + cap + ' of the stable asset issued through ' + n + ' on ' + chain + '; check the peg and the redemption route before sizing up.';
    if (f === 'chain') return 'Bridge $' + cap + ' onto ' + n + ' and put it to work in a native app on the chain; keep the wallet funded for gas.';
    if (f === 'bridge') return 'Bridge $' + cap + ' through ' + n + ' from ' + chain + ' to the chain you farm on, and keep the receipt; check the bridge fee before sizing the move.';
    if (f === 'index') return 'Buy $' + cap + ' of the ' + n + ' index on ' + chain + ' and hold the index token.';
    if (f === 'dex') {
      if ((p.chains || []).indexOf('Bittensor') >= 0) return 'Buy $' + cap + " of the subnet's alpha token with TAO through " + n + " on Bittensor and hold the alpha position; the subnet's own market prices it, there is no liquidity pool to join.";
      return 'Add $' + cap + ' of liquidity to ' + n + "'s largest pool on " + chain + ' and keep the LP tokens.';
    }
    if (f === 'lend') return 'Lend $' + cap + ' of USDC on ' + n + ' (' + chain + ') and leave the loan open.';
    if (f === 'yield') return 'Deposit $' + cap + ' of USDC into ' + n + "'s top vault on " + chain + ' and keep the shares.';
    if (f === 'liquidity') return 'Deposit $' + cap + ' of USDC into a ' + n + '-managed liquidity position on ' + chain + ' and let it rebalance; check the range it sets before depositing.';
    if (f === 'curator') return 'Allocate $' + cap + ' into a ' + n + ' vault on ' + chain + ' and hold the vault shares.';
    if (f === 'perp') return 'Post $' + cap + ' of USDC as margin on ' + n + ' and open one small hedged trade.';
    if (f === 'prediction') return 'Fund your ' + n + ' account with $' + cap + ' and take one market position.';
    if (f === 'rwa') return 'Buy $' + cap + ' of the tokenised real-world asset ' + n + ' offers on ' + chain + ' and hold it.';
    if (f === 'payment') return 'Move $' + cap + ' through ' + n + ' on ' + chain + ' and keep the payment channel funded.';
    if (f === 'insurance') return 'Buy $' + cap + ' of cover from ' + n + ' on ' + chain + ' and keep the policy active.';
    if (f === 'staking') return 'Stake $' + cap + " of the chain's asset through " + n + ' and keep the staking receipt.';
    if (f === 'btc') return 'Hold $' + cap + ' of the BTC-backed asset ' + n + ' issues on ' + chain + ' in a wallet you control.';
    if (f === 'cedefi') return 'Deposit $' + cap + ' of USDC into ' + n + "'s CeDeFi vault on " + chain + ' and keep the position open; check who custodies the funds first.';
    if (f === 'farm') return 'Deposit $' + cap + ' of USDC into ' + n + "'s farm on " + chain + ' and keep the position open; check the reward token\'s unlock schedule.';
    if (f === 'otc') return 'Place a $' + cap + ' order on ' + n + "'s OTC desk on " + chain + " and settle it through the desk's escrow.";
    if (f === 'governance') return 'Lock $' + cap + ' of voting power through ' + n + ' on ' + chain + ' and vote in the current round.';
    return 'Deposit $' + cap + ' of USDC into ' + n + ' on ' + chain + " and keep the position open; read the protocol's own docs first to confirm the position counts.";
  }
  function isBittensorDex(p) { return familyOf(p) === 'dex' && (p.chains || []).indexOf('Bittensor') >= 0; }
  function weeklyFor(p) {
    var f = familyOf(p);
    if (isBittensorDex(p)) return 'Buy a small amount of alpha token with TAO, so the wallet shows fresh subnet activity.';
    if (f === 'lend' || f === 'cdp') return 'Repay a little or top the position up, so the wallet shows fresh borrowing activity.';
    if (f === 'dex' || f === 'liquidity') return 'Swap a small amount through the pool, so the wallet shows fresh trading activity.';
    if (f === 'perp') return 'Check the open trade and rebalance the hedge if it has drifted.';
    if (f === 'prediction') return 'Settle one market or take a new small position, so the wallet stays active.';
    if (f === 'governance') return 'Vote in an open proposal, so the wallet shows fresh governance activity.';
    return 'make a deposit, a borrow, a swap or a vote, so the wallet stays active.';
  }
  function riskFor(p, cap) {
    var f = familyOf(p);
    if (isBittensorDex(p)) return 'Subnet risk: the alpha token is priced by the subnet\'s own mechanism, not by a pool. A subnet that loses emissions can fall faster than TAO itself — size the $' + cap + ' so a bad subnet is a bad week, not a wiped position.';
    if (f === 'dex' || f === 'liquidity') return 'Impermanent loss: if the pool\'s two assets drift apart, the $' + cap + ' comes back worth less than holding them. Size the position so a 20% drift is a bad week, not a wiped position.';
    if (f === 'lend' || f === 'cdp' || f === 'perp') return 'Liquidation: a sharp move can close the position below your entry. Keep the collateral ratio well above the minimum and never borrow against the full $' + cap + '.';
    if (f === 'stable') return 'Depeg: the stable asset can trade below $1 if its backing is doubted. Check the redemption route and the reserves before holding the full $' + cap + ' in it.';
    if (f === 'bridge') return 'Bridge risk: the move depends on a third-party bridge holding your funds mid-transfer. Bridge only what you can afford to have delayed, and confirm the receipt lands.';
    return 'Smart-contract risk: a bug in the protocol\'s contracts can freeze or lose the $' + cap + '. Check whether the contracts are audited and never farm with money you need back.';
  }
  function unwindFor(p, cap) {
    var f = familyOf(p), out;
    if (isBittensorDex(p)) out = 'Sell the alpha position back to TAO through the subnet market, then swap the TAO to USDC.';
    else if (f === 'dex' || f === 'liquidity') out = 'Remove the liquidity and swap the proceeds back to USDC on ' + chainOf(p) + '.';
    else if (f === 'lend') out = 'Repay the loan in full, then withdraw the supplied USDC.';
    else if (f === 'cdp') out = 'Repay the minted stablecoin to unlock the collateral, then withdraw it.';
    else if (f === 'perp') out = 'Close the trade and withdraw the margin that is left.';
    else if (f === 'stable') out = 'Redeem the stable asset back to its backing through the protocol, then move the proceeds out.';
    else if (f === 'yield' || f === 'curator' || f === 'cedefi' || f === 'farm' || f === 'index') out = 'Redeem the shares or tokens back to USDC through the protocol.';
    else out = 'Withdraw the $' + cap + ' position through the protocol\'s own interface.';
    return out + ' Log the wallet, the dates and every transaction hash, so you can repeat the position or prove it later.';
  }
  function stepText(s) {
    var t = s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.';
    if (t.length > 600) t = t.slice(0, 596) + '...';
    if (t.length < 20) t += " Hold the position and check the protocol's own page.";
    return t;
  }
  function farmSteps(p) {
    var chain = chainOf(p), cap = capitalFor(p), hold = holdFor(p.age_days), young = p.age_days === null || p.age_days < 180;
    return [
      (p.chains || []).length > 1
        ? { text: 'Open a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline — ' + p.name + ' runs on ' + p.chains.length + ' chains, so use ' + chain + ' as the home chain for this plan.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' }
        : { text: 'Open a fresh wallet that holds only the funds you plan to farm on ' + chain + ', and store its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, cap, chain), cost: '$' + cap + ' of capital plus about $' + (cap >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Do one qualifying action every week — ' + weeklyFor(p), cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Leave the position untouched for at least ' + hold + ' days, so it is counted in more than one snapshot.', cost: 'the $' + cap + ' stays locked in the position', time: hold + ' days' },
      young
        ? { text: 'No claim is open yet for a protocol this young — watch ' + p.name + "'s own announcements and never trust a claim link from a reply or a DM.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' }
        : { text: "When a claim opens, use only the claim link on the protocol's own site or its official announcement.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: riskFor(p, cap), cost: 'no fee; it only caps what you risk', time: '10 minutes to check' },
      { text: unwindFor(p, cap), cost: 'about $4 of gas to exit', time: '15 minutes to unwind' }
    ].map(stepText);
  }

  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    var q = new URLSearchParams(h);
    if (q.get('q')) state.q = q.get('q');
    if (q.get('category')) state.category = q.get('category');
    if (q.get('chain')) state.chain = q.get('chain');
    if (q.get('tab')) state.tab = q.get('tab');
    if (q.get('wl') === '1') state.wl = true;
    if (q.get('p')) state.selected = q.get('p');
  }
  function writeHash() {
    var q = new URLSearchParams();
    if (state.q) q.set('q', state.q);
    if (state.category !== 'all') q.set('category', state.category);
    if (state.chain !== 'all') q.set('chain', state.chain);
    if (state.wl) q.set('wl', '1');
    if (state.tab !== 'pre') q.set('tab', state.tab);
    if (state.selected) q.set('p', state.selected);
    var s = q.toString();
    window.history.replaceState(null, '', s ? '#' + s : window.location.pathname + window.location.search);
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('b', { text: 'Token Radar' }),
        el('span', { text: 'pre-token launch board · ' + DATA.model_version })),
      el('div', { class: 'top-meta' },
        el('span', { class: 'chip' }, el('span', { class: 'dot' }), 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', { class: 'chip' }, 'DefiLlama protocol index'),
        el('span', { class: 'chip' }, 'Sealed · no network')
      ));
  }

  function kpis() {
    var k = [
      ['Watchlist covered', DATA.watchlist_covered + ' / ' + DATA.watchlist_size, 'counted from the board, not assumed'],
      ['Board rows', String(DATA.board_size), DATA.early_size + ' early finds — ' + DATA.early_below_floor + ' below the $50M floor, ' + DATA.early_above_floor + ' above it'],
      ['Pre-token TVL ranked', fmtUsd(DATA.total_pretoken_tvl), 'across ' + DATA.board_size + ' candidates'],
      ['Top implied value', fmtUsd(DATA.top_implied), DATA.rows[0] ? DATA.rows[0].name : ''],
      ['Median 7d growth', fmtPct(DATA.median_growth), 'across the board'],
      ['Set aside', String(DATA.aside_size + DATA.live_size), DATA.live_size + ' live · ' + DATA.aside_size + ' wrapped / CEX']
    ];
    return el('section', { class: 'kpis' }, k.map(function (x) {
      return el('div', { class: 'kpi' }, el('span', { text: x[0] }), el('b', { text: x[1] }), el('small', { text: x[2] }));
    }));
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied launch value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' genuine launch candidates — ' + DATA.early_below_floor + ' below the floor and ' + DATA.early_above_floor + ' above it, including the ones above the floor the watchlist leaves out. Implied value is a model, not a promise.' })
      ));
  }

  function controls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(chainList(r)); }, []))).sort();
    var search = el('input', { type: 'search', placeholder: 'Search the board', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      cats.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); }));
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var ch = el('select', { 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); }));
    ch.addEventListener('change', function () { state.chain = ch.value; writeHash(); render(); });
    var wl = el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: state.wl ? 'checked' : null }), 'Watchlist only');
    wl.querySelector('input').addEventListener('change', function (e) { state.wl = e.target.checked; writeHash(); render(); });
    function tab(name, label, n) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === name ? 'true' : 'false',
        onclick: function () { state.tab = name; state.selected = null; writeHash(); render(); } },
        label, el('span', { class: 'n', text: String(n) }));
    }
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { text: 'Chain' }), ch),
      wl,
      el('div', { class: 'tabs' }, tab('pre', 'Pre-token', DATA.board_size), tab('live', 'Live token', DATA.live.length), tab('aside', 'Set aside', DATA.aside.length)),
      el('span', { class: 'count', text: countText() })
    );
  }
  function countText() {
    if (state.tab === 'live') return filteredLive().length + ' live-token protocols';
    if (state.tab === 'aside') return filteredAside().length + ' protocols set aside';
    return filteredRows().length + ' rows shown';
  }

  function matches(r, wlOnly) {
    var q = state.q.trim().toLowerCase();
    if (wlOnly && state.wl && r.signal !== 'watchlist') return false;
    if (state.category !== 'all' && r.category !== state.category) return false;
    if (state.chain !== 'all' && chainList(r).indexOf(state.chain) < 0) return false;
    if (!q) return true;
    return [r.name, r.slug, r.category, chainList(r).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
  }
  function filteredRows() {
    return displayRows().filter(function (x) { return matches(x.r, true); });
  }
  function filteredLive() {
    return DATA.live.filter(function (r) { return matches(r, false); });
  }
  function filteredAside() {
    return DATA.aside.filter(function (r) { return matches(r, false); });
  }
  function sortVal(x, key) {
    var r = x.r || x;
    if (key === 'name') return r.name.toLowerCase();
    if (key === 'tvl') return r.tvl_usd;
    if (key === 'growth') return r.change_7d === null ? -Infinity : r.change_7d;
    if (key === 'age') return r.age_days === null ? Infinity : r.age_days;
    if (key === 'mcap') return r.mcap_usd === null ? -Infinity : r.mcap_usd;
    if (key === 'reason') return r.reason || '';
    if (key === 'rank') return -(r.rank === undefined ? (x.displayRank || 0) : r.rank);
    return x.implied === undefined ? r.tvl_usd : x.implied;
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av = sortVal(a, key), bv = sortVal(b, key);
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      var as = (a.r || a).slug, bs = (b.r || b).slug;
      return as < bs ? -1 : 1;
    });
  }
  function sortHeader(key, label, cls) {
    return el('th', { scope: 'col', class: cls || null }, el('button', { type: 'button', onclick: function () {
      if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render();
    } }, label, state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' ▼' : ' ▲' }) : null));
  }
  // A 7-day move as a tiny diverging bar: the zero line, the fill, no invented history.
  // The bar scales to +/-20% so ordinary weekly moves are visible; larger moves clip.
  function spark(g) {
    if (g === null || g === undefined || !isFinite(g)) return el('span', { class: 'sub', text: 'n/a' });
    var c = Math.max(-80, Math.min(80, g)), x0 = 28, x1 = 28 + Math.max(-26, Math.min(26, (c / 20) * 26)), w = Math.abs(x1 - x0);
    var fill = c >= 0 ? '#34d399' : '#f87171';
    return el('span', { class: 'spark', html: '<svg width="56" height="18" viewBox="0 0 56 18" aria-hidden="true"><line x1="28" y1="1" x2="28" y2="17" stroke="#2a3442" stroke-width="1"/><rect x="' + Math.min(x0, x1) + '" y="4" width="' + Math.max(1.5, w) + '" height="10" rx="2" fill="' + fill + '"/></svg>' });
  }
  function subLine(r) {
    return (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? chainList(r).slice(0, 2).join(', ') : 'an unnamed chain');
  }
  function stabilityBadge(r) {
    if (r.stability === 'stable') return el('span', { class: 'badge stable', text: 'STABLE TOP-20' });
    if (r.stability === 'scenario') return el('span', { class: 'badge scenario', text: 'TOP-20 IN ONE SCENARIO' });
    return null;
  }
  function openRow(slug) { openDetail(slug); }
  function rowAttrs(slug) {
    return { 'data-selected': state.selected === slug ? 'true' : 'false', tabindex: '0',
      onclick: function () { openRow(slug); },
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(slug); } } };
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) return emptyPanel();
    var tbody = el('tbody');
    list.forEach(function (x) {
      var r = x.r;
      var tr = el('tr', rowAttrs(r.slug),
        el('td', { class: 'rank' + (x.displayRank <= 3 ? ' top3' : ''), text: String(x.displayRank) }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }),
          el('span', { class: 'sub', text: subLine(r) }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'opt' }, spark(r.change_7d), el('span', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: ' ' + fmtPct(r.change_7d) })),
        el('td', { class: 'num opt', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((x.implied / BOARD_MAX) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(x.implied) }))),
        el('td', { class: 'opt' }, el('div', { class: 'sig' },
          el('span', { class: 'badge ' + (r.signal === 'watchlist' ? 'wl' : 'early'), text: r.signal === 'watchlist' ? 'WATCHLIST' : 'EARLY' }),
          stabilityBadge(r)))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', { class: 'board' },
        el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Bars are scaled to the board maximum (' + fmtUsd(BOARD_MAX) + '), so a bar means the same in every view. Select a row for its model, scenarios and farm plan.' }),
        el('thead', null, el('tr', null,
          sortHeader('rank', 'Rank'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'),
          sortHeader('growth', '7d', 'opt'), sortHeader('age', 'Age', 'opt'), sortHeader('implied', 'Implied value'),
          el('th', { scope: 'col', class: 'opt', text: 'Signal' }))),
        tbody)));
  }

  function liveTable() {
    var list = sortedRows(filteredLive());
    if (list.length === 0) return emptyPanel();
    var tbody = el('tbody');
    list.forEach(function (r) {
      tbody.appendChild(el('tr', rowAttrs(r.slug),
        el('td', null, el('span', { class: 'badge live', text: 'LIVE' })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: subLine(r) }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'opt' }, spark(r.change_7d), el('span', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: ' ' + fmtPct(r.change_7d) })),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'opt' }, el('span', { class: 'badge live', text: 'ALREADY TRADES' }))
      ));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking. Select a row for its market facts.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'), sortHeader('growth', '7d', 'opt'), sortHeader('mcap', 'Market cap'), el('th', { scope: 'col', class: 'opt', text: 'Token' }))),
        tbody)));
  }

  function asideTable() {
    var list = sortedRows(filteredAside());
    if (list.length === 0) return emptyPanel();
    var tbody = el('tbody');
    list.forEach(function (r) {
      tbody.appendChild(el('tr', rowAttrs(r.slug),
        el('td', null, el('span', { class: 'badge aside', text: r.reason.toUpperCase() })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: subLine(r) }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'sub opt', text: r.reason === 'exchange' ? 'A centralised exchange: its token, if any, is not a protocol launch.' : r.reason === 'versioned pool' ? 'A versioned pool of another protocol, not a launch of its own.' : 'A wrapped, staked or bridged product of a token that already trades.' })
      ));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Pre-token on record, set aside from the ranking: exchanges and wrapped, staked or bridged products are not launches waiting to happen. Nothing is hidden. Select a row for why it is set aside.' }),
        el('thead', null, el('tr', null, sortHeader('reason', 'Reason'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'), el('th', { scope: 'col', class: 'opt', text: 'Why it is set aside' }))),
        tbody)));
  }

  function emptyPanel() {
    return el('div', { class: 'panel' }, el('div', { class: 'empty' },
      el('h2', { text: 'No protocol matches that filter' }),
      el('p', { class: 'sub', text: 'Clear the search or pick another category to see the board again.' }),
      el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.wl = false; writeHash(); render(); } })
    ));
  }

  function modelPanel() {
    var m = DATA.model;
    function slider(id, label, min, max, step, val, fmt, key) {
      var out = el('output', { text: fmt(val) });
      var input = el('input', { type: 'range', id: id, min: String(min), max: String(max), step: String(step), value: String(val), 'aria-label': label });
      input.addEventListener('input', function () {
        var v = parseFloat(input.value);
        state.lab[key] = v;
        out.textContent = fmt(v);
        render();
      });
      return el('label', null, label + ' ', out, input);
    }
    var stableCount = DATA.rows.filter(function (r) { return r.stability === 'stable'; }).length;
    var scenRows = DATA.rows.filter(function (r) { return r.stability === 'scenario'; });
    var lab = el('div', { class: 'lab' },
      slider('lab-base', 'Base multiple (FDV per $1 of TVL)', 0.1, 2, 0.05, state.lab.base, function (v) { return v.toFixed(2) + 'x'; }, 'base'),
      slider('lab-growth', 'Growth weight', 0, 1, 0.1, state.lab.growthW, function (v) { return v.toFixed(1); }, 'growthW'),
      slider('lab-mat', 'Maturity floor', 0.5, 0.9, 0.05, state.lab.matFloor, function (v) { return v.toFixed(2); }, 'matFloor'),
      slider('lab-breadth', 'Breadth step (per chain)', 0, 0.03, 0.005, state.lab.breadth, function (v) { return v.toFixed(3); }, 'breadth')
    );
    return el('section', { class: 'panel model' },
      el('h2', null, 'How implied value is computed',
        el('button', { class: 'button', type: 'button', text: 'Reset model', onclick: function () { state.lab = { base: DEF.base, growthW: DEF.growthW, matFloor: DEF.matFloor, breadth: DEF.breadth }; render(); } })),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x ' + m.base_multiple.toFixed(2) + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + (1 - ' + m.maturity_floor + ') x min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ') x (1 + ' + m.breadth_step + ' x min(chains, ' + m.breadth_cap + ')) )'),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days (' + DATA.unknown_age_rows + ' rows on this board) and missing growth counts as 0 (' + DATA.null_growth_rows + ' rows). ' + DATA.clamped_rows + ' rows hit the growth clamp. Chain breadth is a small capped term for distribution. The base 1.00 is calibrated on eleven 2024 DeFi launches (median FDV/TVL 1.13); stablecoin issuers take 0.30 instead (' + DATA.stable_rows + ' rows), because their stablecoin already circulates at $1. Each row also carries the conservative 0.30 and aggressive 2.00 scenarios — see its detail view.' }),
      lab,
      el('p', { class: 'lab-note', html: (labOn() ? '<b>What-if mode:</b> the sliders moved — the board above recomputes live from the same function. board.json carries the defaults, so reset the model to see the submitted ranking.' : 'Move a slider to test the model: the board above recomputes live from the same function. board.json carries the defaults shown here.') + ' Sensitivity: ' + stableCount + ' of the top 20 hold their top-20 spot in all three scenarios' + (scenRows.length ? '; ' + scenRows.map(function (r) { return r.name; }).join(', ') + ' reach the top 20 in one scenario only.' : '.') })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function findRow(slug) {
    var x = displayRows().filter(function (y) { return y.r.slug === slug; })[0];
    if (x) return { kind: 'pre', x: x, row: x.r };
    var live = DATA.live.filter(function (r) { return r.slug === slug; })[0];
    if (live) return { kind: 'live', row: live };
    var aside = DATA.aside.filter(function (r) { return r.slug === slug; })[0];
    if (aside) return { kind: 'aside', row: aside };
    return null;
  }
  function openDetail(slug) {
    var found = findRow(slug);
    if (!found) return;
    var row = found.row;
    state.selected = slug;
    state.tab = found.kind === 'pre' ? 'pre' : found.kind;
    writeHash();
    dialog.textContent = '';
    var headBadge = found.kind === 'pre'
      ? (row.signal === 'watchlist' ? 'WATCHLIST' : 'EARLY FIND')
      : found.kind === 'live' ? 'ALREADY TRADES' : found.row.reason.toUpperCase();
    var headClass = found.kind === 'pre' ? (row.signal === 'watchlist' ? 'wl' : 'early') : found.kind === 'live' ? 'live' : 'aside';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'badge ' + headClass, text: headBadge }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (found.kind === 'pre' ? 'Rank ' + found.x.displayRank + ' of ' + DATA.board_size + ' · ' : '') + (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? chainList(row).join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    if (found.kind === 'live') {
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'Market facts, not a model' }),
        el('div', { class: 'equation' },
          el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
          el('div', null, el('span', { text: 'Market cap' }), el('b', { class: 'num', text: fmtUsd(row.mcap_usd) })),
          el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
          el('div', { class: 'total' }, el('span', { text: 'Token status' }), el('b', { class: 'num', text: 'already trading' }))
        ),
        el('p', { class: 'sub', text: 'This protocol already has a token that trades, so there is no launch left to farm and no implied value to model. It is set aside from the pre-token ranking, not hidden.' })
      ));
    } else if (found.kind === 'aside') {
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'Why it is set aside' }),
        el('div', { class: 'equation' },
          el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
          el('div', null, el('span', { text: 'Reason' }), el('b', { class: 'num', text: row.reason }))
        ),
        el('p', { class: 'sub', text: row.reason === 'exchange' ? 'A centralised exchange: its token, if any, is not a protocol launch.' : row.reason === 'versioned pool' ? 'A versioned pool of another protocol, not a launch of its own.' : 'A wrapped, staked or bridged product of a token that already trades — not a protocol waiting on a launch of its own.' })
      ));
    } else {
      var x = found.x;
      var steps = farmSteps(row);
      var recomputed = impliedOf(row, DEF).implied;
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'Implied value' }),
        el('div', { class: 'equation' },
          el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
          el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
          el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
          el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String((row.chains || []).length) })),
          el('div', null, el('span', { text: 'Base multiple' }), el('b', { class: 'num', text: impliedOf(row, DEF).base.toFixed(2) + 'x' + (isStable(row) ? ' (stablecoin haircut)' : '') })),
          el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: x.gm.toFixed(4) })),
          el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: x.mm.toFixed(4) })),
          el('div', null, el('span', { text: 'Breadth multiplier' }), el('b', { class: 'num', text: x.bm.toFixed(4) })),
          el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(x.implied) }))
        ),
        el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the lab sliders moved.') + ' This is an estimate, not a price.' })
      ));
      var scenRows = [
        { label: 'Conservative', mult: '0.30x', val: row.implied_conservative_usd, rank: row.rank_conservative },
        { label: 'Basis', mult: (isStable(row) ? '0.30x' : '1.00x'), val: row.implied_value_usd, rank: x.displayRank },
        { label: 'Aggressive', mult: '2.00x', val: row.implied_aggressive_usd, rank: row.rank_aggressive }
      ];
      var scenNote = row.stability === 'stable'
        ? 'Top 20 in all three scenarios: the ranking, not just the dollars, survives the range.'
        : row.stability === 'scenario'
          ? 'Top 20 in one scenario only: this row enters the top 20 only when the multiple stretches.'
          : 'Outside the top 20 in every scenario.';
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'What changes the ranking' }),
        el('table', { class: 'scen' },
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Scenario' }), el('th', { scope: 'col', text: 'Multiple' }),
            el('th', { scope: 'col', class: 'num', text: 'Implied value' }), el('th', { scope: 'col', class: 'num', text: 'Rank' }))),
          el('tbody', null, scenRows.map(function (s) {
            return el('tr', { class: s.label === 'Basis' ? 'hl' : null },
              el('td', { text: s.label }), el('td', { class: 'num', text: s.mult }),
              el('td', { class: 'num', text: fmtUsd(s.val) }), el('td', { class: 'num', text: String(s.rank) }));
          }))),
        el('p', { class: 'sub', text: scenNote + ' The scenarios use absolute multiples (0.30 / 1.00 / 2.00); the stablecoin haircut applies at the basis, so the aggressive scenario shows the no-haircut upside. Ranks are the board ranks at the model defaults.' })
      ));
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'Farm plan' }),
        el('ol', { class: 'steps' }, steps.map(function (s) {
          var at = s.indexOf(' Cost: ');
          var action = at >= 0 ? s.slice(0, at) : s;
          var tail = at >= 0 ? s.slice(at + 1) : '';
          return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
        }))
      ));
    }
    dialog.appendChild(el('div', { class: 'note', text: '“No token” means the snapshot records none for this protocol — it may still have one the record does not carry. Implied value is the model’s estimate of what a token would be worth if the protocol’s record stayed as it is; it does not predict whether or when a token is issued.' }));
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(kpis());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre' ? boardTable() : state.tab === 'live' ? liveTable() : asideTable());
    if (state.tab === 'pre') shell.appendChild(modelPanel());
    shell.appendChild(el('p', { class: 'foot', text: 'Source: DefiLlama protocol index, fetched ' + DATA.as_of + ' (sealed snapshot — this page renders with no network). Model ' + DATA.model_version + ': implied value = TVL x 1.00 (0.30 for stablecoin issuers), adjusted for seven-day growth, tenure with no token, and chain breadth; conservative 0.30 and aggressive 2.00 scenarios on every row. Age unknown uses 365 days (' + DATA.unknown_age_rows + ' rows); missing growth counts as 0 (' + DATA.null_growth_rows + ' rows). Estimates, not predictions; nothing here is investment advice. Methodology: see METHODOLOGY.md in the repository.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();

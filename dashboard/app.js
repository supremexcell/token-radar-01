// Token Radar's terminal dashboard. Reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a filterable table, a per-protocol
// detail drawer with the model's own inputs and the protocol's farm plan, and a
// model lab that recomputes the board live from the same function. No network:
// every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var DEF = { base: DATA.model.base_multiple, growthW: DATA.model.growth_weight, matFloor: DATA.model.maturity_floor };
  var state = { q: '', category: 'all', chain: 'all', wl: false, tab: 'pre', sort: 'implied', dir: -1, selected: null,
    lab: { base: DEF.base, growthW: DEF.growthW, matFloor: DEF.matFloor } };
  var labOn = function () { return state.lab.base !== DEF.base || state.lab.growthW !== DEF.growthW || state.lab.matFloor !== DEF.matFloor; };

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
  // The model in one function: the page recomputes a row from the snapshot figures,
  // so the page's code and the board's data are visibly the same arithmetic. The lab
  // overrides the three constants; at the defaults the number matches board.json.
  function impliedOf(r, lab) {
    var m = DATA.model;
    var g = Math.min(m.growth_cap, Math.max(m.growth_floor, r.change_7d === null ? 0 : r.change_7d));
    var gm = 1 + (g / 100) * lab.growthW;
    var age = r.age_days === null ? m.unknown_age_days : r.age_days;
    var mm = lab.matFloor + (1 - lab.matFloor) * (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days);
    var bm = 1 + m.breadth_step * Math.min((r.chains || []).length, m.breadth_cap);
    return { implied: Math.max(1, Math.round(r.tvl_usd * lab.base * gm * mm * bm)), gm: gm, mm: mm, bm: bm, g: g };
  }
  function displayRows() {
    return DATA.rows.map(function (r) {
      var v = impliedOf(r, state.lab);
      return { r: r, implied: v.implied, gm: v.gm, mm: v.mm, bm: v.bm, g: v.g };
    }).sort(function (a, b) { return b.implied - a.implied || (a.r.slug < b.r.slug ? -1 : 1); })
      .map(function (x, i) { x.displayRank = i + 1; return x; });
  }

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
  // chains, TVL and age decide the action, the capital, the hold and every cost
  // and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdFor(age) { if (age === null || age === undefined) return 30; if (age < 180) return 60; if (age < 365) return 45; return 30; }
  function actionFor(p, cap, chain) {
    var c = (p.category || '').toLowerCase(), n = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Lend $' + cap + ' of USDC on ' + n + ' (' + chain + ') and leave the loan open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('swap') >= 0) return 'Add $' + cap + ' of liquidity to ' + n + "'s deepest pool on " + chain + ' and keep the LP tokens.';
    if (c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('aggregator') >= 0) return 'Deposit $' + cap + ' of USDC into ' + n + "'s top vault on " + chain + ' and keep the shares.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Post $' + cap + ' of USDC as margin on ' + n + ' and open one small hedged trade.';
    if (c.indexOf('prediction') >= 0) return 'Fund your ' + n + ' account with $' + cap + ' and take one market position.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('capital') >= 0) return 'Allocate $' + cap + ' into a ' + n + ' vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or hold $' + cap + ' of the stable asset issued through ' + n + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Buy $' + cap + ' of the tokenised real-world asset ' + n + ' offers on ' + chain + ' and hold it.';
    if (c.indexOf('payment') >= 0) return 'Move $' + cap + ' through ' + n + ' on ' + chain + ' and keep the payment channel funded.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + cap + ' of cover from ' + n + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('staking') >= 0) return 'Stake $' + cap + " of the chain's asset through " + n + ' and keep the staking receipt.';
    return 'Deposit $' + cap + ' of USDC into ' + n + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(s) {
    var t = s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.';
    if (t.length > 600) t = t.slice(0, 596) + '...';
    if (t.length < 20) t += " Hold the position and check the protocol's own page.";
    return t;
  }
  function farmSteps(p) {
    var chain = chainOf(p), cap = capitalFor(p), hold = holdFor(p.age_days);
    return [
      { text: 'Open a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, cap, chain), cost: '$' + cap + ' of capital plus about $' + (cap >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Do one qualifying action every week — a deposit, a borrow, a swap or a vote — so the wallet stays active.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Leave the position untouched for at least ' + hold + ' days, so it is counted in more than one snapshot.', cost: 'the $' + cap + ' stays locked in the position', time: hold + ' days' },
      { text: "When a claim opens, use only the claim link on the protocol's own site or its official announcement.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Log the wallet, the dates and every transaction hash, so you can repeat the position or unwind it cleanly.', cost: 'nothing but the log', time: '5 minutes' }
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
      ['Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'every slug on the floor'],
      ['Board rows', String(DATA.board_size), DATA.early_size + ' early finds below the floor'],
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
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' genuine launch candidates below it — including the ones above the floor the watchlist leaves out. Implied value is a model, not a promise.' })
      ));
  }

  function controls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();
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
    if (state.tab === 'live') return DATA.live.length + ' live-token protocols';
    if (state.tab === 'aside') return DATA.aside.length + ' protocols set aside';
    return filteredRows().length + ' rows shown';
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return displayRows().filter(function (x) {
      var r = x.r;
      if (state.wl && r.signal !== 'watchlist') return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var x = a.r, y = b.r, av, bv;
      if (key === 'name') { av = x.name.toLowerCase(); bv = y.name.toLowerCase(); }
      else if (key === 'tvl') { av = x.tvl_usd; bv = y.tvl_usd; }
      else if (key === 'growth') { av = x.change_7d === null ? -Infinity : x.change_7d; bv = y.change_7d === null ? -Infinity : y.change_7d; }
      else if (key === 'age') { av = x.age_days === null ? Infinity : x.age_days; bv = y.age_days === null ? Infinity : y.age_days; }
      else { av = a.implied; bv = b.implied; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return x.slug < y.slug ? -1 : 1;
    });
  }
  function sortHeader(key, label) {
    return el('th', { scope: 'col' }, el('button', { type: 'button', onclick: function () {
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

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { class: 'sub', text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.wl = false; writeHash(); render(); } })
      ));
    }
    var max = 1;
    list.forEach(function (x) { if (x.implied > max) max = x.implied; });
    var tbody = el('tbody');
    list.forEach(function (x) {
      var r = x.r;
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'rank' + (x.displayRank <= 3 ? ' top3' : ''), text: String(x.displayRank) }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', null, spark(r.change_7d), el('span', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: ' ' + fmtPct(r.change_7d) })),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((x.implied / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(x.implied) }))),
        el('td', null, el('span', { class: 'badge ' + (r.signal === 'watchlist' ? 'wl' : 'early'), text: r.signal === 'watchlist' ? 'WATCHLIST' : 'EARLY' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
        el('thead', null, el('tr', null,
          sortHeader('implied', 'Rank'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'),
          sortHeader('growth', '7d'), sortHeader('age', 'Age'), sortHeader('implied', 'Implied value'),
          el('th', { scope: 'col', text: 'Signal' }))),
        tbody)));
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'badge live', text: 'LIVE' })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', null, spark(r.change_7d), el('span', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: ' ' + fmtPct(r.change_7d) })),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'badge live', text: 'ALREADY TRADES' }))
      ));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
        tbody)));
  }

  function asideTable() {
    var tbody = el('tbody');
    DATA.aside.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'badge aside', text: r.reason.toUpperCase() })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'sub', text: r.reason === 'exchange' ? 'A centralised exchange: its token, if any, is not a protocol launch.' : r.reason === 'versioned pool' ? 'A versioned pool of another protocol, not a launch of its own.' : 'A wrapped, staked or bridged product of a token that already trades.' })
      ));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Pre-token on record, set aside from the ranking: exchanges and wrapped, staked or bridged products are not launches waiting to happen. Nothing is hidden.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Reason' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Why it is set aside' }))),
        tbody)));
  }

  function modelPanel() {
    var m = DATA.model;
    function slider(id, label, min, max, step, val, fmt) {
      var out = el('output', { text: fmt(val) });
      var input = el('input', { type: 'range', id: id, min: String(min), max: String(max), step: String(step), value: String(val), 'aria-label': label });
      input.addEventListener('input', function () {
        var v = parseFloat(input.value);
        if (id === 'lab-base') state.lab.base = v;
        if (id === 'lab-growth') state.lab.growthW = v;
        if (id === 'lab-mat') state.lab.matFloor = v;
        out.textContent = fmt(v);
        render();
      });
      return el('label', null, label + ' ', out, input);
    }
    var lab = el('div', { class: 'lab' },
      slider('lab-base', 'Base multiple (FDV per $1 of TVL)', 0.1, 0.6, 0.05, state.lab.base, function (v) { return v.toFixed(2) + 'x'; }),
      slider('lab-growth', 'Growth weight', 0, 1, 0.1, state.lab.growthW, function (v) { return v.toFixed(1); }),
      slider('lab-mat', 'Maturity floor', 0.5, 0.9, 0.05, state.lab.matFloor, function (v) { return v.toFixed(2); })
    );
    return el('section', { class: 'panel model' },
      el('h2', null, 'How implied value is computed',
        el('button', { class: 'button', type: 'button', text: 'Reset model', onclick: function () { state.lab = { base: DEF.base, growthW: DEF.growthW, matFloor: DEF.matFloor }; render(); } })),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x ' + m.base_multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + (1 - ' + m.maturity_floor + ') x min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ') x (1 + ' + m.breadth_step + ' x min(chains, ' + m.breadth_cap + ')) )'),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. Chain breadth is a small capped term for distribution. The early radar is every genuine launch candidate below the watchlist floor, and the live-token and wrapped protocols are set aside with their market caps or reasons shown.' }),
      lab,
      el('p', { class: 'lab-note', html: labOn() ? '<b>What-if mode:</b> the sliders moved — the board above recomputes live from the same function. board.json carries the defaults, so reset the model to see the submitted ranking.' : 'Move a slider to test the model: the board above recomputes live from the same function. board.json carries the defaults shown here.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var x = displayRows().filter(function (y) { return y.r.slug === slug; })[0];
    if (!x) return;
    var row = x.r;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DEF).implied;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'badge ' + (row.signal === 'watchlist' ? 'wl' : 'early'), text: row.signal === 'watchlist' ? 'WATCHLIST' : 'EARLY FIND' }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: 'Rank ' + x.displayRank + ' of ' + DATA.board_size + ' · ' + (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String((row.chains || []).length) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: x.gm.toFixed(4) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: x.mm.toFixed(4) })),
        el('div', null, el('span', { text: 'Breadth multiplier' }), el('b', { class: 'num', text: x.bm.toFixed(4) })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(x.implied) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the lab sliders moved.') + ' This is an estimate, not a price.' })
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
    shell.appendChild(el('p', { class: 'foot', text: 'Source: DefiLlama protocol index, fetched ' + DATA.as_of + ' (sealed snapshot — this page renders with no network). Model ' + DATA.model_version + ': implied value = TVL x 0.30, adjusted for seven-day growth, tenure with no token, and chain breadth. Estimates, not predictions; nothing here is investment advice. Methodology: see METHODOLOGY.md in the repository.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();

export function renderReceiverPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <title>Live Caption Bridge Receiver</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, "Segoe UI", Arial, sans-serif; background: #070a10; color: #f7f9fd; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; min-height: 100dvh; background: radial-gradient(circle at 50% -15%, #1a2b45 0, #0a0e16 42%, #06080d 100%); }
    .shell { min-height: 100vh; min-height: 100dvh; display: grid; grid-template-rows: auto auto 1fr auto; gap: clamp(12px, 2vh, 24px); padding: max(18px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
    h1 { margin: 0; font-size: clamp(17px, 4vw, 25px); letter-spacing: -.02em; }
    #connection { display: flex; align-items: center; gap: 7px; color: #aeb8c8; font-size: 12px; }
    #connection::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #ed9b60; box-shadow: 0 0 0 4px #ed9b6025; }
    #connection.connected::before { background: #6fe0be; box-shadow: 0 0 0 4px #6fe0be25; }
    nav { display: flex; gap: 7px; overflow-x: auto; padding-bottom: 2px; }
    button, select { border: 1px solid #344158; border-radius: 999px; background: #121926; color: #dbe2ed; padding: 8px 12px; font: inherit; font-size: 12px; white-space: nowrap; }
    button[aria-pressed="true"] { background: #79ddc1; border-color: #79ddc1; color: #07120e; font-weight: 800; }
    select { display: none; margin-left: auto; }
    body[data-profile="glance"] select { display: block; }
    main { display: grid; grid-template-rows: 1fr 1fr; gap: clamp(12px, 2vh, 22px); min-height: 0; }
    .lane { min-height: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: clamp(18px, 5vw, 42px); border: 1px solid #28364c; border-radius: clamp(18px, 4vw, 28px); background: linear-gradient(155deg, #141d2bd9, #0a0f18e8); overflow: hidden; }
    .label { color: #7fe1c5; font-size: clamp(11px, 2.4vw, 15px); font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
    .history { min-height: 1.25em; margin-top: auto; color: #aeb8c9; opacity: .75; font-size: clamp(16px, 3.8vw, 30px); line-height: 1.25; }
    .current { margin-top: .45em; font-size: clamp(27px, 7vw, 58px); line-height: 1.12; font-weight: 760; overflow-wrap: anywhere; text-wrap: balance; }
    .current.partial { opacity: .8; }
    body[data-profile="english"] #vietnamese-lane, body[data-profile="vietnamese"] #english-lane { display: none; }
    body[data-profile="english"] main, body[data-profile="vietnamese"] main, body[data-profile="glance"] main { grid-template-rows: 1fr; }
    body[data-profile="glance"] #vietnamese-lane { display: none; }
    body[data-profile="glance"] #english-lane { border: 0; background: transparent; padding-inline: 2vw; }
    body[data-profile="glance"] .history, body[data-profile="glance"] .label { display: none; }
    body[data-profile="glance"] .current { font-size: clamp(34px, 9vw, 78px); text-align: center; }
    footer { display: flex; justify-content: space-between; gap: 16px; color: #79869a; font-size: 10px; }
    #notice { color: #ffbd86; text-align: right; }
    @media (orientation: landscape) and (max-height: 560px) {
      .shell { grid-template-rows: auto 1fr auto; }
      nav { position: absolute; left: -9999px; }
      main { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
      .current { font-size: clamp(24px, 4.8vw, 48px); }
    }
  </style>
</head>
<body data-profile="bilingual">
  <div class="shell">
    <header><h1>Live Caption Bridge</h1><span id="connection">Connecting</span></header>
    <nav aria-label="Caption view">
      <button data-profile="bilingual" aria-pressed="true">Bilingual</button>
      <button data-profile="english" aria-pressed="false">English</button>
      <button data-profile="vietnamese" aria-pressed="false">Tiếng Việt</button>
      <button data-profile="glance" aria-pressed="false">Glance</button>
      <select id="glance-locale" aria-label="Glance language"><option value="en-US">English glance</option><option value="vi-VN">Tiếng Việt glance</option></select>
    </nav>
    <main aria-live="polite">
      <section class="lane" id="english-lane"><div class="label">English</div><div class="history" id="english-history"></div><div class="current" id="english-current"></div></section>
      <section class="lane" id="vietnamese-lane"><div class="label">Tiếng Việt</div><div class="history" id="vietnamese-history"></div><div class="current" id="vietnamese-current"></div></section>
    </main>
    <footer><span>Read-only local receiver</span><span id="notice">Authenticated, not encrypted</span></footer>
  </div>
  <script>
    (() => {
      const connection = document.getElementById('connection');
      const notice = document.getElementById('notice');
      const glanceLocale = document.getElementById('glance-locale');
      const nodes = {
        englishHistory: document.getElementById('english-history'),
        englishCurrent: document.getElementById('english-current'),
        vietnameseHistory: document.getElementById('vietnamese-history'),
        vietnameseCurrent: document.getElementById('vietnamese-current')
      };
      let snapshot;
      let reconnectTimer;
      const parameters = new URLSearchParams(location.hash.slice(1));
      const token = parameters.get('token') || '';
      const requestedProfile = new URLSearchParams(location.search).get('profile');
      const validProfiles = ['bilingual', 'english', 'vietnamese', 'glance'];

      function setText(node, value) { node.textContent = value || ''; }
      function segmentText(segment, locale) {
        if (!segment) return '';
        return (segment.texts && segment.texts[locale]) || (segment.sourceLocale === locale ? segment.sourceText : '');
      }
      function setProfile(profile) {
        const next = validProfiles.includes(profile) ? profile : 'bilingual';
        document.body.dataset.profile = next;
        document.querySelectorAll('[data-profile]').forEach(button => {
          if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.profile === next));
        });
        render();
      }
      function render() {
        if (!snapshot) return;
        const recent = (snapshot.finalized || []).slice(-2);
        const current = snapshot.partial || recent.at(-1);
        const prior = recent.slice(0, -1);
        const glance = document.body.dataset.profile === 'glance';
        const glanceText = segmentText(current, glanceLocale.value);
        setText(nodes.englishHistory, prior.map(item => segmentText(item, 'en-US')).join('  •  '));
        setText(nodes.vietnameseHistory, prior.map(item => segmentText(item, 'vi-VN')).join('  •  '));
        setText(nodes.englishCurrent, glance ? glanceText : segmentText(current, 'en-US'));
        setText(nodes.vietnameseCurrent, segmentText(current, 'vi-VN'));
        nodes.englishCurrent.classList.toggle('partial', Boolean(snapshot.partial));
        nodes.vietnameseCurrent.classList.toggle('partial', Boolean(snapshot.partial));
        if (['error', 'reconnecting'].includes(snapshot.status.phase)) notice.textContent = 'Captions temporarily unavailable';
        else notice.textContent = 'Authenticated, not encrypted';
      }
      function connect() {
        clearTimeout(reconnectTimer);
        if (!/^[a-f0-9]{32}$/i.test(token)) {
          connection.textContent = 'Pairing link invalid';
          notice.textContent = 'Ask the operator for a new QR code';
          return;
        }
        const socket = new WebSocket('ws://' + location.host + '/events');
        socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'auth', token })));
        socket.addEventListener('message', event => {
          try {
            const envelope = JSON.parse(event.data);
            if (envelope.version !== 1 || envelope.type !== 'snapshot') return;
            snapshot = envelope.payload;
            connection.textContent = 'Live';
            connection.classList.add('connected');
            render();
          } catch { notice.textContent = 'Invalid caption event'; }
        });
        socket.addEventListener('close', event => {
          connection.classList.remove('connected');
          connection.textContent = event.code === 1008 ? 'Pairing expired' : 'Reconnecting';
          if (event.code !== 1008) reconnectTimer = setTimeout(connect, 1000);
        });
      }

      document.querySelectorAll('button[data-profile]').forEach(button => button.addEventListener('click', () => setProfile(button.dataset.profile)));
      glanceLocale.addEventListener('change', render);
      setProfile(validProfiles.includes(requestedProfile) ? requestedProfile : 'bilingual');
      connect();
    })();
  </script>
</body>
</html>`
}

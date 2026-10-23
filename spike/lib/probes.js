// Page-visible automation / fingerprint / network signals, plus a heuristic score.
// Everything here runs inside the page; nothing is asserted about CDP internals we
// cannot observe.
export async function collectSignals(page) {
  return page.evaluate(async () => {
    const hash = (s) => {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
      return (h >>> 0).toString(16);
    };

    let webglVendor = null;
    let webglRenderer = null;
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        webglVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
        webglRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      }
    } catch {}

    let canvasHash = null;
    try {
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 60;
      const ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 200, 60);
      ctx.fillStyle = '#069';
      ctx.fillText('jobPilot canvas probe', 4, 20);
      canvasHash = hash(c.toDataURL());
    } catch {}

    let notificationPermission = null;
    try {
      notificationPermission = (await navigator.permissions.query({ name: 'notifications' })).state;
    } catch {}

    // Host candidates only: no STUN server is contacted.
    let rtcCandidates = [];
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('x');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise((res) => {
        const done = () => res();
        pc.onicecandidate = (e) => e.candidate?.candidate?.includes('candidate:') && rtcCandidates.push(e.candidate.candidate);
        setTimeout(done, 1500);
      });
      pc.close();
    } catch {}

    const ua = navigator.userAgent;
    return {
      ua,
      webdriver: navigator.webdriver,
      chromeRuntime: typeof window.chrome?.runtime,
      chromeObject: typeof window.chrome,
      plugins: navigator.plugins.length,
      mimeTypes: navigator.mimeTypes.length,
      languages: navigator.languages,
      platform: navigator.platform,
      uaDataPlatform: navigator.userAgentData?.platform ?? null,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory ?? null,
      maxTouchPoints: navigator.maxTouchPoints,
      cdcProps: Object.keys(window).filter((k) => /^(\$?cdc_|__webdriver|webdriver$)/.test(k)),
      headlessUA: /Headless/i.test(ua),
      windowOuter: [window.outerWidth, window.outerHeight],
      windowInner: [window.innerWidth, window.innerHeight],
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        colorDepth: screen.colorDepth,
        dpr: window.devicePixelRatio,
      },
      webglVendor,
      webglRenderer,
      canvasHash,
      notificationPermission,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      tzOffsetMinutes: new Date().getTimezoneOffset(),
      rtcCandidates,
    };
  });
}

const BANDS = [
  [80, 'Safe'],
  [60, 'Caution'],
  [0, 'Risky'],
];

export function scoreSignals(s, host) {
  const cats = [];
  const cat = (name, weight, items) => {
    const lost = items.filter((i) => i.status === 'FAIL').reduce((a, i) => a + i.penalty, 0);
    const lostWarn = items.filter((i) => i.status === 'WARN').reduce((a, i) => a + i.penalty / 2, 0);
    cats.push({
      name,
      weight,
      earned: Math.max(0, weight - lost - lostWarn),
      items,
    });
  };
  const item = (label, status, penalty, detail) => ({ label, status, penalty, detail });

  cat('automation', 30, [
    item(
      'navigator.webdriver',
      s.webdriver === false || s.webdriver === undefined ? 'PASS' : 'FAIL',
      20,
      `webdriver=${s.webdriver}`,
    ),
    item('cdc/cdriver leftovers', s.cdcProps.length === 0 ? 'PASS' : 'FAIL', 10, `props=${JSON.stringify(s.cdcProps)}`),
    item('window.chrome present', s.chromeObject === 'object' ? 'PASS' : 'FAIL', 5, `typeof chrome=${s.chromeObject}`),
    item('headless UA marker', s.headlessUA ? 'FAIL' : 'PASS', 10, s.ua.slice(0, 60)),
    item('window metrics non-zero', s.windowOuter[0] > 0 ? 'PASS' : 'FAIL', 8, `outer=${s.windowOuter}`),
    item('plugins populated', s.plugins > 0 ? 'PASS' : 'FAIL', 3, `plugins=${s.plugins}`),
  ]);

  // Software rendering (llvmpipe/Mesa) on a headless host is the loudest coherence signal we can see.
  const softwareGl = /llvmpipe|swiftshader|software/i.test(`${s.webglVendor} ${s.webglRenderer}`);
  const noGl = !s.webglRenderer;
  cat('fingerprint', 25, [
    item(
      'WebGL renderer coherent',
      noGl ? 'FAIL' : softwareGl ? 'WARN' : 'PASS',
      8,
      noGl ? 'no WebGL context at all (driverless/Xvfb) — real Chrome always exposes one'
        : `${s.webglVendor} / ${s.webglRenderer}`,
    ),
    item(
      'UA platform vs navigator.platform',
      (() => {
        const uaX64 = /x86_64|x64/i.test(s.ua);
        const platX64 = /x86_64|x64|Win64/i.test(s.platform);
        return uaX64 === platX64 ? 'PASS' : 'FAIL';
      })(),
      6,
      `ua64=${/x86_64|Win64/i.test(s.ua)} platform=${s.platform}`,
    ),
    item('canvas fingerprint stable', s.canvasHash ? 'PASS' : 'FAIL', 4, `hash=${s.canvasHash}`),
    item('screen dimensions', s.screen.width > 0 && s.screen.height > 0 ? 'PASS' : 'FAIL', 4, JSON.stringify(s.screen)),
    item('notification permission not auto-denied', s.notificationPermission === 'denied' ? 'WARN' : 'PASS', 4, `${s.notificationPermission}`),
  ]);

  const hostTz = host?.timezone ?? null;
  const ipTz = host?.ipTimezone ?? null;
  const publicCandidate = s.rtcCandidates.some((c) =>
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(c) && !/[ .](?:10|127|172\.(?:1[6-9]|2\d|3[01])|192\.168)\./.test(c),
  );
  cat('network', 15, [
    item('timezone vs host clock', hostTz && s.timezone !== hostTz ? 'WARN' : 'PASS', 4, `page=${s.timezone} host=${hostTz}`),
    item(
      'timezone vs IP geolocation',
      ipTz && s.timezone !== ipTz ? 'FAIL' : ipTz ? 'PASS' : 'WARN',
      9,
      ipTz ? `page=${s.timezone} ip=${ipTz}` : 'IP geolocation unavailable — cannot check coherence',
    ),
    item('WebRTC private address only', publicCandidate ? 'FAIL' : 'PASS', 2, `${s.rtcCandidates.length} candidates`),
  ]);

  const totalWeight = cats.reduce((a, c) => a + c.weight, 0);
  const earned = cats.reduce((a, c) => a + c.earned, 0);
  const score = Math.round((earned / totalWeight) * 100);
  const band = BANDS.find(([min]) => score >= min)[1];
  return { score, band, categories: cats };
}

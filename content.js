(() => {
'use strict';
if (window.__noizrosPointsV16) return;
window.__noizrosPointsV16 = true;
const DEBUG = false;
const log = (...args) => {if(DEBUG) console.debug('[noizros Twitch Points]',...args)};
// src/utils/claim-button.js
// Find claimable bonus button within a root (summary or document)
// Used by tests and copied into content script during build

const CLAIM_ARIA_LABELS = [
  'Claim Bonus',
  'Få bonus',
  'Bonus einfordern',
  'Reclamar bonificación',
  'Reclamar bono',
  'Récupérer un bonus',
  'Riscatta bonus',
  'Bónusz igénylése',
  'Bonus claimen',
  'Motta bonus',
  'Odbierz bonus',
  'Receber bónus',
  'Resgatar Bônus',
  'Obține bonusul',
  'Vyzdvihnúť bonus',
  'Lunasta bonus',
  'Hämta bonus',
  'Nhận thưởng',
  'Bonusu al',
  'Vyzvednout bonus',
  'Διεκδίκηση μπόνους',
  'Получаване на бонус',
  'Получить бонус',
  'เคลมโบนัส',
  '领取奖励',
  '領取額外獎勵',
  'ボーナスを受け取る',
  '보너스 받기'
];

const CLAIM_ARIA_SELECTOR = CLAIM_ARIA_LABELS.map(
  (label) => `[aria-label="${globalThis.CSS?.escape?.(label) ?? label}"]`
).join(',');

function findCommunityPointsSummary(doc = document) {
  return (
    doc.querySelector('[data-test-selector="community-points-summary"]') ||
    doc.querySelector('.community-points-summary') ||
    null
  );
}

function findButtonByAriaLabel(root) {
  return root.querySelector(CLAIM_ARIA_SELECTOR);
}

function normalizeToButton(el, root) {
  if (!el) return null;
  if (el.nodeName === 'BUTTON') return el;
  return el.querySelector?.('button') || findButtonByAriaLabel(root) || null;
}

/**
 * Find the claimable bonus button within root (summary element or document).
 * Prefers stable selectors; hashed styled-components classes are last resort.
 */
function findClaimButton(root = document) {
  const scope = root || document;

  let button =
    scope.querySelector('[data-test-selector="claimable-bonus"]') ||
    scope.querySelector('.claimable-bonus__icon')?.closest('button') ||
    findButtonByAriaLabel(scope) ||
    // Legacy hashed classes (fragile; last resort)
    scope.querySelector('.ScCoreButtonSuccess-sc-1qn4ixc-5') ||
    scope.querySelector('.ScCoreButtonSuccess-sc-ocjdkf-1');

  button = normalizeToButton(button, scope);
  if (!button || button.disabled) return null;
  return button;
}

/**
 * Resolve claim button: search summary first, then fall back to full document
 * when the button is rendered outside the community-points-summary subtree.
 */
function resolveClaimButton(summary, doc = document) {
  const searchRoot = summary || doc;
  let button = findClaimButton(searchRoot);
  if (!button && summary) {
    button = findClaimButton(doc);
  }
  return button;
}

// src/utils/claim-guard.js
// Idempotency for claim clicks: WeakSet of handled buttons + cooldown
// Used by tests and copied into content script during build

const DEFAULT_COOLDOWN_MS = 2000;

/**
 * Create a claim guard. In browser, pass nothing (uses WeakSet).
 * In tests, you may inject a Set-like store that holds button refs.
 */
function createClaimGuard(options = {}) {
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const handled = options.handled ?? new WeakSet();
  let lastClaimAt = 0;

  function canClaim(button) {
    if (!button) return false;
    if (handled.has(button)) return false;
    if (Date.now() - lastClaimAt < cooldownMs) return false;
    return true;
  }

  function markClaimed(button) {
    if (button) handled.add(button);
    lastClaimAt = Date.now();
  }

  function resetCooldownForTests(now = 0) {
    lastClaimAt = now;
  }

  return { canClaim, markClaimed, resetCooldownForTests };
}

const excluded = new Set(['directory','settings','subscriptions','downloads','wallet','inventory','drops','videos','search','p','moderator','following']);
const guard = createClaimGuard({cooldownMs:2000});
function getChannel(){
  if(location.hostname !== 'www.twitch.tv')return null;
  const path=location.pathname.split('/').filter(Boolean);
  if(path.length!==1 || !/^[a-z0-9_]{1,25}$/i.test(path[0]) || excluded.has(path[0].toLowerCase()))return null;
  return path[0].toLowerCase();
}
function report(type,channel){try{chrome.runtime.sendMessage({type,channel});}catch(e){log(e)}}
let summaryObserver=null,bodyObserver=null,observedSummary=null,summaryTimeout=null,bodyTimeout=null;
let claimTimer=null;
function scan(){
  claimTimer=null;
  const channel=getChannel();if(!channel)return;
  const button=resolveClaimButton(findCommunityPointsSummary(document),document);
  if(!button || !guard.canClaim(button))return;
  guard.markClaimed(button);
  report('CLAIM_ATTEMPT',channel);
  button.click();
  // Original upstream counts successful click attempts. We only count when UI disappears.
  setTimeout(()=>{
    if(!button.isConnected || !resolveClaimButton(findCommunityPointsSummary(document),document)) {
      report('CLAIM_UI_SUCCESS',channel);
    }
  },1200);
}
function scheduleScan(){if(!claimTimer)claimTimer=setTimeout(scan,300)}
function disconnectSummary(){summaryObserver?.disconnect();summaryObserver=null;observedSummary=null}
function observeSummary(el){
  if(!el || el===observedSummary)return;
  disconnectSummary();observedSummary=el;
  summaryObserver=new MutationObserver(()=>{
    clearTimeout(summaryTimeout);summaryTimeout=setTimeout(scheduleScan,100);
  });
  summaryObserver.observe(el,{childList:true,subtree:true});
  scheduleScan();
}
function rediscover(){
  const el=findCommunityPointsSummary(document);
  if(el && el!==observedSummary)observeSummary(el);
  else if(!el && observedSummary)disconnectSummary();
}
function init(){
  rediscover();
  if(document.body){
    bodyObserver=new MutationObserver(()=>{
      clearTimeout(bodyTimeout);bodyTimeout=setTimeout(rediscover,500);
    });
    bodyObserver.observe(document.body,{childList:true,subtree:true});
  }
  setInterval(()=>{rediscover();scheduleScan()},5000);
  scheduleScan();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

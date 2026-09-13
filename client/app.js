'use strict';

/**
 * Wallet connection, with no third-party scripts.
 *
 * The previous page loaded React, ReactDOM, Babel and ethers from two CDNs with
 * no Subresource Integrity. Any one of those files could be swapped at the edge
 * and the page would execute it with full access to the wallet prompt — the
 * exact "wallet-draining signature" path. SRI would have narrowed that, but the
 * dependencies were not needed at all: MetaMask's injected provider does
 * everything this page does. Removing them closes the threat instead of
 * documenting it, and lets the CSP be script-src 'self'.
 *
 * The signing step is deliberately slow and readable. The founder's human
 * security layer requires that a user be shown, in plain language, what a
 * signature does and does not permit BEFORE they are asked to approve it.
 */

const el = (id) => document.getElementById(id);

function setStatus(text, kind = 'info') {
  const node = el('status');
  node.textContent = text;
  node.className = `status status--${kind}`;
}

/** Plain-English reading of the challenge, shown before the wallet prompt. */
function explain(address) {
  el('explain-address').textContent = address;
  el('explainer').hidden = false;
}

async function requestAddress() {
  if (!window.ethereum) {
    throw new Error('No Ethereum wallet found. Install MetaMask to continue.');
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No account was shared.');
  }
  return accounts[0];
}

async function postJSON(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function connect() {
  const button = el('connect');
  button.disabled = true;
  try {
    setStatus('Requesting your wallet address…');
    const address = await requestAddress();
    el('address').textContent = address;
    explain(address);

    setStatus('Requesting a single-use challenge from the server…');
    const challenge = await postJSON('/api/auth/challenge', { address });

    // Show the exact bytes before asking for a signature. A user who cannot
    // read what they are signing cannot meaningfully consent to it.
    el('message').textContent = challenge.message;
    el('message-block').hidden = false;

    setStatus('Check your wallet and review the message before approving.');
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [challenge.message, address],
    });

    setStatus('Verifying signature…');
    const email = el('email').value.trim();
    const result = await postJSON('/api/connect-wallet', {
      address,
      nonce: challenge.nonce,
      signature,
      email: email || undefined,
    });

    setStatus(`Connected as ${result.user.address}`, 'ok');
  } catch (err) {
    // User rejection is not a failure worth alarming anyone about.
    const rejected = err && (err.code === 4001 || /user rejected/i.test(err.message || ''));
    setStatus(rejected ? 'Signature declined.' : (err.message || 'Connection failed.'),
      rejected ? 'info' : 'error');
  } finally {
    button.disabled = false;
  }
}

el('connect').addEventListener('click', connect);

const byId = (id) => document.getElementById(id);

function showToast(message, error = false) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.className = error ? 'visible error' : 'visible';
  window.setTimeout(() => {
    toast.className = '';
  }, 6000);
}

function escapeText(value) {
  const span = document.createElement('span');
  span.textContent = String(value);
  return span.innerHTML;
}

function renderOpportunities(opportunities) {
  const body = byId('opportunity-rows');
  if (!opportunities.length) {
    body.innerHTML =
      '<tr><td colspan="4" class="empty">No accepted opportunities yet.</td></tr>';
    return;
  }

  body.innerHTML = opportunities
    .map(
      (opportunity) => `
        <tr>
          <td><code>${escapeText(opportunity.opportunity_id)}</code><br />${escapeText(opportunity.title)}</td>
          <td>${escapeText(opportunity.asset_or_business_type)}</td>
          <td>${escapeText(opportunity.source_status)}</td>
          <td>${escapeText(opportunity.decision_status)}</td>
        </tr>`,
    )
    .join('');
}

async function loadDashboard() {
  try {
    const response = await fetch('/api/v1/dashboard');
    if (!response.ok) throw new Error('Dashboard projection unavailable');
    const data = await response.json();
    byId('active-stage').textContent = `${data.current_stage} · Research sandbox`;
    byId('unauthorized-effects').textContent =
      data.unauthorized_external_effects;
    byId('sbm').textContent =
      `${data.single_bottleneck_metric.percentage}%`;
    byId('accepted').textContent = data.metrics.opportunities_accepted;
    byId('refused').textContent = data.metrics.opportunities_rejected;
    byId('chain-state').textContent = data.metrics.event_chain_valid
      ? 'VALID'
      : 'DISARMED';
    byId('event-count').textContent =
      `${data.metrics.institutional_events} append-only institutional events.`;
    renderOpportunities(data.opportunities);
  } catch (error) {
    showToast(error.message, true);
    byId('chain-state').textContent = 'UNAVAILABLE';
  }
}

async function authenticateWallet() {
  if (!window.ethereum) {
    showToast('No Ethereum wallet provider was found.', true);
    return;
  }

  const button = byId('wallet-button');
  button.disabled = true;
  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });
    const address = accounts[0];
    const chainHex = await window.ethereum.request({ method: 'eth_chainId' });
    const challengeResponse = await fetch('/api/v1/identity/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        chain_id: Number.parseInt(chainHex, 16),
      }),
    });
    const challenge = await challengeResponse.json();
    if (!challengeResponse.ok) {
      throw new Error(challenge.error?.message ?? 'Challenge failed');
    }

    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [challenge.message, address],
    });
    const sessionResponse = await fetch('/api/v1/identity/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        nonce: challenge.nonce,
        signature,
      }),
    });
    const session = await sessionResponse.json();
    if (!sessionResponse.ok) {
      throw new Error(session.error?.message ?? 'Identity verification failed');
    }

    window.sessionStorage.setItem('pumpstation_identity_token', session.token);
    byId('identity-state').textContent = session.actor.actor_id;
    button.textContent = 'Identity authenticated';
    showToast(
      'Wallet verified for identity only. No transaction or asset authority was granted.',
    );
  } catch (error) {
    showToast(error.message ?? 'Wallet authentication failed', true);
  } finally {
    button.disabled = false;
  }
}

byId('wallet-button').addEventListener('click', authenticateWallet);
loadDashboard();

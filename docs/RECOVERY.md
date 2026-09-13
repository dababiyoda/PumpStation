# PumpStation recovery procedures

Every feature in `governance/feature-control-matrix.json` names a recovery
procedure here and whether it has actually been exercised. A procedure that has
never been run is recorded as `tested: false`, and the admission gate refuses
any consequential feature in that state.

> Secure does not mean nothing ever fails. It means failures have bounded
> impact, detection is fast, evidence survives, affected actions stop
> automatically, participants are warned, recovery authority is predefined,
> restitution is possible, and restart requires verified correction.

---

## wallet-connect

**What can fail**

| Failure | Detection | Bounded by |
|---|---|---|
| Challenge store exhausted | `503` with code `capacity` on `/api/auth/challenge` | `DEFAULT_MAX_PENDING` (10 000 pending) |
| Challenge flooding from one source | `429` with `RateLimit-*` headers | 10 challenges/min/IP |
| Signature grinding | `429`, and each nonce dies on first attempt | 20 verifications/min/IP |
| Private key of a user compromised | Not detectable by this service | The user's own wallet; this service holds no keys |
| Process restart | Pending challenges lost | Users re-request; challenges are 5 minutes old at most |

**Blast radius.** Full compromise of this endpoint yields an attacker an
authenticated session for an address they already control, plus the ability to
write an email onto their own record. No key material, no signing authority and
no treasury path exists from this feature. Maximum financial loss is $0.

**Recovery steps**

1. **Stop the bleeding.** Set `ALLOWED_ORIGINS=` (empty) to deny all
   cross-origin traffic while investigating. Same-origin use continues.
2. **Invalidate every pending challenge.** Restart the process. The nonce store
   is in-memory, so this is complete and immediate — no challenge survives a
   restart, by design.
3. **Confirm the invalidation.** `GET /api/health` returns `ok: true`; any
   previously issued nonce now fails with `unknown_or_expired_nonce`.
4. **Check for authentication bypass.** Run the auth suite against the running
   build: `cd server && npm test`. The replay, expiry, cross-domain and
   address-mismatch cases must all pass. If any fails, the deployed build is not
   the reviewed build.
5. **Reduce the window.** If grinding continues, lower `ttlMs` on the
   `NonceStore` and the `max` on both limiters, then restart.
6. **Restart requires verified correction.** Do not restore `ALLOWED_ORIGINS`
   until step 4 passes on the exact commit being served.

**Exercised**

`server/test/siwe.test.js` — 16 cases run on every `npm test`. They exercise
steps 2 and 4 directly: nonce invalidation (`a valid signature cannot be
replayed`, `a failed attempt consumes the nonce`), expiry
(`an expired challenge is rejected`), and the authentication-bypass check
(`REGRESSION: rejects a signature over the old static connect message`).

Last exercised: 2026-07-27.

**What is not yet exercised**

Steps 1, 3 and 5 involve a running process and are currently verified by reading
the code, not by an integration test. This is a real gap and it is recorded here
rather than smoothed over: the `tested: true` claim in the matrix rests on the
unit-level invalidation and bypass evidence above, which is what bounds the
blast radius. A process-level incident rehearsal is the next thing to build.

---

## shared-challenge-store

Not designed. No procedure exists, and the matrix records `tested: false`.

---

## treasury-multisig

Not designed. No procedure exists, and the matrix records `tested: false`. The
gate refuses this feature today on four separate rules; the recovery procedure
is one of them and must be written and exercised before any real-value
deployment.

Required before this section can be written:

- signer-loss procedure (M-of-N with one, two, then M−1 signers unavailable);
- key-rotation procedure with the treasury live;
- timelock-cancellation procedure for a queued but unwanted transfer;
- restitution source and its authorization path;
- the exact condition under which the treasury is frozen permanently.

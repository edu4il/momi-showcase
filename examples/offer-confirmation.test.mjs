import test from 'node:test';
import assert from 'node:assert/strict';
import { OfferConfirmation } from './offer-confirmation.mjs';

const request = { userId: 'A', eventId: 'demo-event', offerId: 'demo-offer' };
function fixture() {
  const records = new Map();
  const f = {
    user: 'A', writes: 0, queries: 0,
    store: {
      async save(r) { records.set(JSON.stringify(r), { ...r }); },
      async remove(r) { records.delete(JSON.stringify(r)); },
    },
    records,
    result: { ...request, status: 'confirmed',
      attendee: { userId: 'A', eventId: 'demo-event', status: 'confirmed' } },
    async submit(r) {
      assert.equal(records.size, 1, 'save must finish before remote submission');
      f.writes++;
      await f.gate;
      if (f.error) throw f.error;
      return { ...r, status: 'confirmed' };
    },
    async query() { f.queries++; if (f.queryError) throw f.queryError; return f.result; },
  };
  f.coordinator = () => new OfferConfirmation({ store: f.store, currentUser: () => f.user,
    confirmRemote: r => f.submit(r), queryRemote: r => f.query(r) });
  return f;
}

test('ten concurrent confirmations share one write and one result', async () => {
  const f = fixture(), c = f.coordinator();
  let release;
  f.gate = new Promise(resolve => { release = resolve; });
  const results = Array.from({ length: 10 }, () => c.confirm(request));
  assert.ok(results.every(result => result === results[0]));
  release();
  assert.ok((await Promise.all(results)).every(r => r.status === 'confirmed'));
  assert.equal(f.writes, 1);
  assert.equal(f.records.size, 0);
});

test('lost response is reconciled with the exact offer without a second write', async () => {
  const f = fixture(); f.error = new Error('response lost');
  assert.equal((await f.coordinator().confirm(request)).status, 'confirmed');
  assert.equal(f.writes, 1);
  assert.equal(f.queries, 1);
  assert.equal(f.records.size, 0);
});

test('a new coordinator recovers the saved request with zero writes', async () => {
  const f = fixture(); await f.store.save(request);
  assert.equal((await f.coordinator().recover(request)).status, 'confirmed');
  assert.equal(f.writes, 0);
  assert.equal(f.queries, 1);
});

test('pending offers keep their recovery record without repeated queries', async () => {
  const f = fixture(); f.error = new Error('offline'); f.result.status = 'pending';
  assert.equal((await f.coordinator().confirm(request)).status, 'unresolved');
  assert.equal(f.records.size, 1);
  assert.equal(f.writes, 1);
  assert.equal(f.queries, 1);
});

test('another offer or a missing attendee cannot prove this confirmation', async () => {
  for (const change of [{ offerId: 'another-offer' }, { attendee: null }]) {
    const f = fixture(); f.error = new Error('lost'); Object.assign(f.result, change);
    assert.equal((await f.coordinator().confirm(request)).status, 'unresolved');
    assert.equal(f.records.size, 1);
  }
});

test('failed reconciliation keeps the record even when attendance was confirmed', async () => {
  const f = fixture(); f.error = new Error('lost'); f.queryError = new Error('offline');
  assert.equal((await f.coordinator().confirm(request)).status, 'unresolved');
  assert.equal(f.records.size, 1);
  assert.equal(f.writes, 1);
});

test('expired and cancelled offers clear only their own record', async () => {
  for (const status of ['expired', 'cancelled']) {
    const f = fixture(); f.error = new Error('lost'); f.result.status = status;
    await f.store.save({ ...request, offerId: 'another-offer' });
    // This fixture normally asserts a single saved request; preserve both here.
    f.submit = async () => { f.writes++; throw f.error; };
    assert.equal((await f.coordinator().confirm(request)).status, status);
    assert.equal(f.records.size, 1);
    assert.equal([...f.records.values()][0].offerId, 'another-offer');
  }
});

test('storage failure prevents the remote write', async () => {
  const f = fixture(); f.store.save = async () => { throw new Error('storage full'); };
  await assert.rejects(f.coordinator().confirm(request), /storage full/);
  assert.equal(f.writes, 0);
});

test('a definitive server rejection is not retried or reconciled', async () => {
  const f = fixture(); f.error = Object.assign(new Error('denied'), { definitive: true });
  await assert.rejects(f.coordinator().confirm(request), /denied/);
  assert.equal(f.writes, 1);
  assert.equal(f.queries, 0);
  assert.equal(f.records.size, 0);
});

test('logout and login with the same user still reject the old completion', async () => {
  const f = fixture(), c = f.coordinator();
  let release, entered;
  const submitted = new Promise(resolve => { entered = resolve; });
  f.gate = new Promise(resolve => { release = resolve; });
  const submit = f.submit;
  f.submit = r => { entered(); return submit(r); };
  const task = c.confirm(request);
  const rejected = assert.rejects(task, /Session changed/);
  await submitted;
  c.sessionChanged();
  release();
  await rejected;
  assert.equal(f.records.size, 1);
  assert.equal(f.queries, 0);
});

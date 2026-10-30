// Teaching example. Inject a store and a fake remote; no production endpoints.
// A request is { userId, eventId, offerId }. Keep IDs, not display names, as keys.
const keyOf = r => JSON.stringify([r.userId, r.eventId, r.offerId]);
const same = (a, b) => a?.userId === b.userId && a?.eventId === b.eventId &&
  a?.offerId === b.offerId;

export class OfferConfirmation {
  #active = new Map();
  #generation = 0;

  constructor({ store, currentUser, confirmRemote, queryRemote }) {
    Object.assign(this, { store, currentUser, confirmRemote, queryRemote });
  }

  // Call on logout/account changes, even if the next login uses the same ID.
  sessionChanged() { this.#generation++; }

  confirm(request) { return this.#execute({ ...request }, true); }
  recover(request) { return this.#execute({ ...request }, false); }

  #execute(request, submit) {
    const key = keyOf(request);
    if (this.#active.has(key)) return this.#active.get(key);
    const generation = this.#generation;
    const checkSession = () => {
      if (generation !== this.#generation || this.currentUser() !== request.userId) {
        throw new Error('Session changed');
      }
    };
    // Start in a microtask so the shared task is registered before any callbacks.
    const task = Promise.resolve().then(async () => {
      checkSession();
      if (submit) {
        await this.store.save(request);
        checkSession();
        try {
          const result = await this.confirmRemote(request);
          checkSession();
          if (same(result, request) && result.status === 'confirmed') {
            await this.store.remove(request);
            checkSession();
            return { status: 'confirmed' };
          }
        } catch (error) {
          checkSession();
          if (error.definitive) {
            await this.store.remove(request);
            throw error;
          }
          // An uncertain response leads to a read, never an automatic second write.
        }
      }
      let result;
      try { result = await this.queryRemote(request); }
      catch {
        checkSession();
        return { status: 'unresolved' };
      }
      checkSession();
      if (!same(result, request)) return { status: 'unresolved' };
      const attendeeMatches = result.attendee?.userId === request.userId &&
        result.attendee?.eventId === request.eventId && result.attendee?.status === 'confirmed';
      if ((result.status === 'confirmed' && attendeeMatches) ||
          result.status === 'expired' || result.status === 'cancelled') {
        await this.store.remove(request);
        checkSession();
        return { status: result.status };
      }
      return { status: 'unresolved' };
    }).finally(() => {
      if (this.#active.get(key) === task) this.#active.delete(key);
    });
    this.#active.set(key, task);
    return task;
  }
}

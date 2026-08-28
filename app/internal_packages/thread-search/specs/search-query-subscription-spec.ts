import _ from 'underscore';
import { DatabaseStore, Thread } from 'mailspring-exports';

import SearchQuerySubscription from '../lib/search-query-subscription';

describe('SearchQuerySubscription', () => {
  it('expands the retained query range past the old 1000-result boundary', () => {
    spyOn(_, 'defer').andReturn(null);

    const subscription = new SearchQuerySubscription('invoice', ['account-1']);
    (subscription as any)._query = DatabaseStore.findAll<Thread>(Thread).limit(1000);

    let replacement = null;
    spyOn(subscription, 'replaceQuery').andCallFake((query) => {
      replacement = query;
    });

    subscription.replaceRange({ start: 940, end: 1000 });

    expect(replacement).not.toBe(null);
    expect(replacement.range().end).toBeGreaterThan(1000);
  });
});

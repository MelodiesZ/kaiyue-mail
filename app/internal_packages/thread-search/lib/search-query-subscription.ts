import _ from 'underscore';
import {
  Actions,
  Thread,
  DatabaseStore,
  SearchQueryParser,
  ComponentRegistry,
  MutableQuerySubscription,
} from 'mailspring-exports';

const INITIAL_SEARCH_RANGE = 200;
const SEARCH_RANGE_OVERSCAN = 200;

class SearchQuerySubscription extends MutableQuerySubscription<Thread> {
  _searchQuery: string;
  _accountIds: string[];
  _connections = [];
  _extDisposables = [];
  _searching = false;
  _retainedRange = { start: 0, end: INITIAL_SEARCH_RANGE };

  constructor(searchQuery: string, accountIds: string[]) {
    super(null, { emitResultSet: true });
    this._searchQuery = searchQuery;
    this._accountIds = accountIds;

    _.defer(() => this.performSearch());
  }

  replaceRange = ({ start, end }: { start: number; end: number }) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return;
    }

    // Keep a generous window around the viewport. This makes scrolling feel
    // immediate without loading every matching thread (and its messages) into
    // memory. Unlike the previous fixed limit(1000), the window can advance
    // through the complete local result set.
    this._retainedRange = {
      start: Math.max(0, Math.floor(start) - SEARCH_RANGE_OVERSCAN),
      end: Math.max(INITIAL_SEARCH_RANGE, Math.ceil(end) + SEARCH_RANGE_OVERSCAN),
    };

    if (!this._query) {
      return;
    }

    const next = this._query.clone().page(this._retainedRange.start, this._retainedRange.end);
    if (!next.range().isEqual(this._query.range())) {
      this.replaceQuery(next);
    }
  };

  performSearch() {
    this._searching = true;
    this.performLocalSearch();
    this.performExtensionSearch();
  }

  performLocalSearch() {
    let dbQuery = DatabaseStore.findAll<Thread>(Thread);
    if (this._accountIds.length === 1) {
      dbQuery = dbQuery.where({ accountId: this._accountIds[0] });
    }

    try {
      const parsedQuery = SearchQueryParser.parse(this._searchQuery);
      dbQuery = dbQuery.structuredSearch(parsedQuery);
    } catch (e) {
      console.info('Failed to parse local search query, falling back to generic query', e);
      dbQuery = dbQuery.search(this._searchQuery);
    }
    dbQuery = dbQuery
      .background()
      .order(Thread.attributes.lastMessageReceivedTimestamp.descending())
      .page(this._retainedRange.start, this._retainedRange.end);

    this.replaceQuery(dbQuery);
  }

  _createResultAndTrigger() {
    super._createResultAndTrigger();
    if (this._searching) {
      this._searching = false;
      Actions.searchCompleted();
    }
  }

  _addThreadIdsToSearch(ids: string[] = []) {
    const currentResults = this._set && this._set.ids().length > 0;
    let searchIds = ids;
    if (currentResults) {
      const currentResultIds = this._set.ids();
      searchIds = [...new Set(currentResultIds.concat(ids))];
    }
    const dbQuery = DatabaseStore.findAll<Thread>(Thread)
      .where({ id: searchIds })
      .order(Thread.attributes.lastMessageReceivedTimestamp.descending());
    this.replaceQuery(dbQuery);
  }

  performRemoteSearch() {
    // TODO: Perform IMAP search here.
    //
    // This is temporarily disabled because we support Gmail's
    // advanced syntax locally (eg: in: inbox, is:unread), and
    // search message bodies, so local search is pretty much
    // good enough for v1. Come back and implement this soon!
    //
  }

  performExtensionSearch() {
    const searchExtensions = ComponentRegistry.findComponentsMatching({
      role: 'SearchBarResults',
    });

    this._extDisposables = searchExtensions.map((ext) => {
      return ext.observeThreadIdsForQuery(this._searchQuery).subscribe((ids = []) => {
        const allIds = ids.flat().filter(Boolean);
        if (allIds.length === 0) return;
        this._addThreadIdsToSearch(allIds);
      });
    });
  }

  onLastCallbackRemoved() {
    this._connections.forEach((conn) => conn.end());
    this._extDisposables.forEach((disposable) => disposable.dispose());
  }
}

export default SearchQuerySubscription;

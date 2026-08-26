import { Actions, TaskQueue } from 'mailspring-exports';
import { FeatureUsageStore } from '../../src/flux/stores/feature-usage-store';
import { IdentityStore } from '../../src/flux/stores/identity-store';

describe('FeatureUsageStore', function featureUsageStoreSpec() {
  beforeEach(() => {
    this.fakeIdentity = {
      id: 'foo',
      featureUsage: {
        'is-usable': {
          quota: 10,
          period: 'monthly',
          usedInPeriod: 8,
          featureLimitName: 'Usable Group A',
        },
        'not-usable': {
          quota: 10,
          period: 'monthly',
          usedInPeriod: 10,
          featureLimitName: 'Unusable Group A',
        },
      },
    };
    spyOn(IdentityStore, 'identity').andReturn(this.fakeIdentity);
    spyOn(IdentityStore, 'saveIdentity').andCallFake(async (ident) => {
      this.fakeIdentity = ident;
    });
  });

  describe('isUsable', () => {
    it("returns true if a feature hasn't met it's quota", () => {
      expect(FeatureUsageStore.isUsable('is-usable')).toBe(true);
    });

    it('returns true even if a legacy identity is at its upstream quota', () => {
      expect(FeatureUsageStore.isUsable('not-usable')).toBe(true);
    });

    it('returns true if no quota is present for the feature', () => {
      spyOn(console, 'warn');
      expect(FeatureUsageStore.isUsable('unsupported')).toBe(true);
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('markUsed', () => {
    beforeEach(() => {
      spyOn(Actions, 'queueTask');
    });

    afterEach(() => {
      TaskQueue._queue = [];
    });

    it('does not increment legacy identity counters', () => {
      const before = this.fakeIdentity.featureUsage['is-usable'].usedInPeriod;
      FeatureUsageStore.markUsed('is-usable');
      const after = this.fakeIdentity.featureUsage['is-usable'].usedInPeriod;
      expect(after).toEqual(before);
    });

    it('does not queue feature usage tasks to an upstream server', () => {
      FeatureUsageStore.markUsed('is-usable');
      expect(Actions.queueTask).not.toHaveBeenCalled();
    });
  });

  describe('markUsedOrUpgrade', () => {
    beforeEach(() => {
      spyOn(FeatureUsageStore, 'markUsed').andReturn(Promise.resolve());
      spyOn(Actions, 'openModal');
    });

    it('bypasses upstream quotas and promotions in Kaiyue Mail', async () => {
      await FeatureUsageStore.markUsedOrUpgrade('not-usable', {} as any);
      expect(FeatureUsageStore.markUsed).not.toHaveBeenCalled();
      expect(Actions.openModal).not.toHaveBeenCalled();
    });

    it('does not record usage for usable features', async () => {
      await FeatureUsageStore.markUsedOrUpgrade('is-usable', {} as any);
      expect(FeatureUsageStore.markUsed).not.toHaveBeenCalled();
    });

    it('never opens an upgrade modal for an exhausted legacy quota', async () => {
      await FeatureUsageStore.markUsedOrUpgrade('not-usable', {
        headerText: 'all test used',
        rechargeText: 'add a test to',
        iconUrl: 'icon url',
      });
      expect(Actions.openModal).not.toHaveBeenCalled();
    });
  });
});

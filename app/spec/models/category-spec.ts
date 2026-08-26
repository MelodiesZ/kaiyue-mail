import { Folder } from '../../src/flux/models/folder';

describe('Category', () => {
  it('shows the legacy Mailspring helper folder with Kaiyue branding', () => {
    const folder = new Folder({ path: 'Mailspring', role: null });

    expect(folder.displayName).toBe('凯越');
  });
});

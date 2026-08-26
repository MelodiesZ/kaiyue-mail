import { RenderSignatureData, ResolveSignatureData } from '../lib/constants';

describe('signature privacy', () => {
  it('does not query the upstream company-logo service', () => {
    const resolved = ResolveSignatureData({
      email: 'user@kaiyuedrill.com',
      photoURL: 'company',
    });

    expect(resolved.photoURL).toBe('');
    expect(JSON.stringify(resolved)).not.toContain('getmailspring.com');
  });

  it('renders social marks without upstream image assets', () => {
    const html = RenderSignatureData({
      templateName: 'Basic',
      name: 'Kaiyue User',
      facebookURL: 'https://example.com/profile',
      linkedinURL: 'https://example.com/profile',
    });

    expect(html).not.toContain('getmailspring.com');
    expect(html).not.toContain('signature-assets');
  });
});

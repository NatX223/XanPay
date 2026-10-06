/** Where the connect-modal iframe is hosted. Override via XanPayBrowserConfig.baseUrl for local development. */
const DEFAULT_MODAL_ORIGIN = 'https://xanpay.com';

export interface XanPayBrowserConfig {
  platformId: string;
  /** Overrides where the connect-modal iframe is loaded from. Defaults to the production XanPay app. */
  baseUrl?: string;
}

export interface LinkOptions {
  /** Called with the opaque linkToken once the user approves a card. Exchange it server-side via XanPay.exchangeLinkToken() — never send it anywhere else. */
  onSuccess: (linkToken: string) => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Browser-only XanPay client — the connect-modal iframe flow. Holds no secret (there's no apiKey here),
 * so it's safe to bundle into client-side code. For charging, exchanging link tokens, balances, etc.,
 * see the XanPay class in '@xanpay/sdk' (server-side only).
 */
export class XanPayBrowser {
  private readonly platformId: string;
  private readonly baseUrl: string;

  constructor(config: XanPayBrowserConfig) {
    if (!config.platformId) throw new Error('XanPayBrowser: platformId is required');
    this.platformId = config.platformId;
    this.baseUrl = config.baseUrl ?? DEFAULT_MODAL_ORIGIN;
  }

  /** Opens the XanPay connect modal as an iframe overlay on top of the current page. */
  link(options: LinkOptions): void {
    const { onSuccess, onCancel, onError } = options;
    const expectedOrigin = new URL(this.baseUrl).origin;

    const overlay = document.createElement('div');
    overlay.setAttribute('data-xanpay-overlay', '');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(11,27,51,0.55);';

    const iframe = document.createElement('iframe');
    const modalUrl = new URL('/connect-modal', this.baseUrl);
    modalUrl.searchParams.set('platformId', this.platformId);
    modalUrl.searchParams.set('origin', window.location.origin);
    iframe.src = modalUrl.toString();
    iframe.title = 'Connect your XanCard';
    iframe.style.cssText =
      'border:none;width:400px;height:500px;max-width:92vw;max-height:88vh;border-radius:12px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,0.35);';

    overlay.appendChild(iframe);

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      overlay.remove();
    };

    const handleMessage = (event: MessageEvent) => {
      // The browser only delivers this if event.origin actually matches — this check is redundant
      // defense-in-depth, not the primary guarantee.
      if (event.origin !== expectedOrigin) return;

      const data = event.data as { type?: string; linkToken?: string } | undefined;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'XANPAY_LINK_SUCCESS' && data.linkToken) {
        cleanup();
        onSuccess(data.linkToken);
      } else if (data.type === 'XANPAY_LINK_CANCEL') {
        cleanup();
        onCancel?.();
      }
    };

    window.addEventListener('message', handleMessage);

    iframe.onerror = () => {
      cleanup();
      onError?.(new Error('Failed to load the XanPay connect modal'));
    };

    // Clicking the backdrop (not the iframe itself) is treated the same as the in-modal Cancel button.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        onCancel?.();
      }
    });

    document.body.appendChild(overlay);
  }
}

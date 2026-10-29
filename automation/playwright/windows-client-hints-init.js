// Makes the page's own platform signals agree with the Windows user agent
// and Sec-CH-UA-Platform header set in playwright/config.json.
(() => {
  try {
    Object.defineProperty(Navigator.prototype, 'platform', {
      get: () => 'Win32',
      configurable: true,
    });
  } catch (e) {
    // ignore
  }
  const original = navigator.userAgentData;
  if (original) {
    const spoofed = {
      brands: original.brands,
      mobile: false,
      platform: 'Windows',
      toJSON: () => ({ brands: original.brands, mobile: false, platform: 'Windows' }),
      getHighEntropyValues: async (hints) => {
        const values = await original.getHighEntropyValues(hints);
        return {
          ...values,
          platform: 'Windows',
          platformVersion: '15.0.0',
          architecture: 'x86',
          bitness: '64',
        };
      },
    };
    try {
      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        get: () => spoofed,
        configurable: true,
      });
    } catch (e) {
      // ignore
    }
  }
})();
// 

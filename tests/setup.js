const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] !== undefined ? store[key] : null),
    setItem: jest.fn((key, value) => { store[key] = String(value); }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

class MockIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.elements = [];
    this.disconnect = jest.fn();
  }
  observe(element) { this.elements.push(element); }
  unobserve(element) { this.elements = this.elements.filter(e => e !== element); }
  triggerIntersection(isIntersecting = true) {
    this.elements.forEach(el => {
      this.callback([{ isIntersecting, target: el }]);
    });
  }
}
globalThis.IntersectionObserver = MockIntersectionObserver;

globalThis.fetch = jest.fn();

globalThis.showToast = jest.fn();
globalThis.PROXY_URL = '/proxy/';
globalThis.window = globalThis;

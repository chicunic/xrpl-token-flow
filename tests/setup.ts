// Jest setup file for global test configuration

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

const EXPECTED_ERROR_PREFIXES = ['Error expected in test:'];

beforeAll(() => {
  console.log = (...args: any[]) => {
    const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
    process.stderr.write(`\x1b[36m${message}\x1b[0m\n`);
  };

  console.error = jest.fn((...args: any[]) => {
    const fullMessage = args.map(arg => String(arg)).join(' ');
    const isExpected = EXPECTED_ERROR_PREFIXES.some(prefix => fullMessage.includes(prefix));
    if (!isExpected) {
      originalConsoleError(...args);
    }
  });
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

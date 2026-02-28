import { vi } from 'vitest';

export function createVitestMock() {
  return vi.fn();
}

export function createSimpleModuleMock(modulePath: string, mockImplementations: Record<string, any>) {
  return vi.mock(modulePath, () => mockImplementations);
}

import { expect, it } from 'vitest';
import { CORE_VERSION } from '../src/index';

it('il package core è importabile', () => {
  expect(CORE_VERSION).toBe('0.0.0');
});

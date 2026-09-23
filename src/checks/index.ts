import type { Check } from '../core/types';
import { helloCheck } from './hello';
import { scriptCheck } from './script';

export const registry: Record<string, Check> = {
  hello: helloCheck,
  lint: scriptCheck('lint', 'lint'),
  typecheck: scriptCheck('typecheck', 'typecheck'),
  unit: scriptCheck('unit', 'test:unit'),
  integration: scriptCheck('integration', 'test:integration'),
  coverage: scriptCheck('coverage', 'test:coverage'),
  e2e: scriptCheck('e2e', 'test:e2e', 'test-results'),
};
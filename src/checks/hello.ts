import type { Check } from '../core/types';

export const helloCheck: Check = {
  id: 'hello',
  async run() {
    return { status: 'pass', summary: 'Le framework fonctionne' };
  },
};
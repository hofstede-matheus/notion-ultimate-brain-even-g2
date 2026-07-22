import { describe, expect, it } from 'vitest';
import { TASK_VIEWS } from '../views';

describe('TASK_VIEWS', () => {
  it('defines a static filter for every task view', () => {
    for (const view of TASK_VIEWS) {
      expect(view.filter).toBeDefined();
    }
  });
});

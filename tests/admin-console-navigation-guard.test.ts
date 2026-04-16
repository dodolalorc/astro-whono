import { describe, expect, it } from 'vitest';
import {
  shouldGuardAdminNavigation,
  type AdminNavigationGuardInput
} from '../src/scripts/admin-console/navigation-guard';

describe('admin-console/navigation-guard', () => {
  const baseInput: AdminNavigationGuardInput = {
    isDirty: true,
    currentUrl: 'http://localhost:4321/admin/theme/',
    nextUrl: 'http://localhost:4321/admin/'
  };
  const cases: Array<{
    name: string;
    input: AdminNavigationGuardInput;
    expected: boolean;
  }> = [
    {
      name: 'guards same-origin route switches when the form is dirty',
      input: baseInput,
      expected: true
    },
    {
      name: 'ignores hash-only jumps on the same document',
      input: {
        ...baseInput,
        nextUrl: 'http://localhost:4321/admin/theme/#site'
      },
      expected: false
    },
    {
      name: 'ignores modified clicks',
      input: {
        ...baseInput,
        metaKey: true
      },
      expected: false
    },
    {
      name: 'ignores non-self targets',
      input: {
        ...baseInput,
        target: '_blank'
      },
      expected: false
    },
    {
      name: 'ignores clean state',
      input: {
        ...baseInput,
        isDirty: false
      },
      expected: false
    },
    {
      name: 'ignores cross-origin jumps',
      input: {
        ...baseInput,
        nextUrl: 'https://example.com/admin/'
      },
      expected: false
    }
  ];

  it.each(cases)('$name', ({ input, expected }) => {
    expect(shouldGuardAdminNavigation(input)).toBe(expected);
  });
});

import { render } from 'preact';
import { describe, expect, it } from 'vitest';
import { Simulator } from '../index';

describe('Simulator placeholder', () => {
  it('renders in a DOM environment', () => {
    const el = document.createElement('div');
    render(<Simulator />, el);
    expect(el.textContent).toContain('Table coming soon');
  });
});

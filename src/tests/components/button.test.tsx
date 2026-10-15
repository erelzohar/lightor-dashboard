import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Button from '../../components/ui/Button';

/**
 * LT-351: a loading button grows by its spinner while it and the buttons
 * beside it fade to disabled; with `transition-all` iPhone Safari left the
 * old paint behind (a second label beside the button). Colours only.
 */
describe('Button', () => {
  it('transitions colours only, never opacity or size', () => {
    render(
      <Button isLoading variant="primary">
        Save
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button.className).toContain('transition-colors');
    expect(button.className).not.toMatch(/transition-all|transition-opacity/);
  });
});

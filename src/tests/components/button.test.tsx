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
    // LT-363: a pop button also moves its lip and its press, never a size.
    const transition = button.className.match(/transition-\[([^\]]+)\]/)?.[1].split(',');
    expect(transition).toEqual(['background-color', 'box-shadow', 'transform']);
    expect(button.className).not.toMatch(/transition-all|transition-opacity|\btransition(?![-\w])/);
  });

  it('keeps transition-colors on the variants that are not pop buttons', () => {
    render(
      <>
        <Button variant="outline">Edit</Button>
        <Button variant="ghost">Skip</Button>
      </>
    );
    for (const name of ['Edit', 'Skip']) {
      expect(screen.getByRole('button', { name }).className).toContain('transition-colors');
    }
  });

  /**
   * LT-363: the filled variants are pop buttons. The press is a 2px translate
   * and the lip a shadow, never a border change: a border change resizes the
   * button, which is LT-351's ghost-paint trigger. LT-366: the edge is an
   * inset shadow too, so a pop button is exactly the size it was (a 2px
   * border made them 4px bigger: "ערוך פרטים", the chart's arrows).
   */
  it('makes the filled variants pop buttons that press without resizing', () => {
    render(
      <>
        <Button variant="primary">Go</Button>
        <Button variant="danger">Delete</Button>
        <Button variant="success">Done</Button>
      </>
    );
    const edges = { Go: 'violet.800', Delete: 'red.800', Done: 'green.800' };
    for (const [name, edge] of Object.entries(edges)) {
      const cls = screen.getByRole('button', { name }).className;
      expect(cls).toContain(`[--pop-edge:theme(colors.${edge})]`);
      expect(cls).toContain('shadow-[inset_0_0_0_2px_var(--pop-edge),0_2px_0_0_var(--pop-edge)]');
      expect(cls).toContain('[&:not(:disabled):active]:translate-y-[2px]');
      // No border at all: nothing adds to the button's size.
      expect(cls).not.toMatch(/(^|\s)border(-\d|-[a-z]+-\d{3})?(\s|$)/);
    }
  });
});

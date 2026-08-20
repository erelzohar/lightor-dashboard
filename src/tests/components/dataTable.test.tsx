import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DataTable, { DataTableColumn } from '../../components/ui/DataTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', darkMode: false }),
}));

/**
 * The server-driven table primitive (LT-058). It renders exactly what it is
 * given and reports intent (page, sort, search) through callbacks — these
 * tests pin that contract.
 */
interface Row {
  id: string;
  name: string;
}

const columns: DataTableColumn<Row>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'id', label: 'Id' },
];

const rows: Row[] = [
  { id: 'r1', name: 'Alpha' },
  { id: 'r2', name: 'Beta' },
];

describe('DataTable', () => {
  it('renders rows and fires onRowClick', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />
    );

    fireEvent.click(screen.getByText('Beta'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it('shows the empty state when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(r: Row) => r.id} />);
    expect(screen.getByText('admin.table.empty')).toBeInTheDocument();
  });

  it('pages forward through the callback and disables past the last page', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        pagination={{ total: 4, page: 2, limit: 2, pages: 2 }}
        onPageChange={onPageChange}
      />
    );

    const next = screen.getByLabelText('admin.table.nextPage');
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByLabelText('admin.table.previousPage'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('toggles sort order on a sortable header', () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        sort="name"
        order="desc"
        onSortChange={onSortChange}
      />
    );

    fireEvent.click(screen.getByText('Name'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'asc');

    // A non-sortable column reports nothing.
    fireEvent.click(screen.getByText('Id'));
    expect(onSortChange).toHaveBeenCalledTimes(1);
  });

  it('debounces search input before reporting it', async () => {
    vi.useFakeTimers();
    try {
      const onSearchChange = vi.fn();
      render(
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          searchValue=""
          onSearchChange={onSearchChange}
        />
      );

      const input = screen.getByPlaceholderText('admin.table.search');
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'ac' } });
      fireEvent.change(input, { target: { value: 'acme' } });

      expect(onSearchChange).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(350);
      });
      expect(onSearchChange).toHaveBeenCalledTimes(1);
      expect(onSearchChange).toHaveBeenCalledWith('acme');
    } finally {
      vi.useRealTimers();
    }
  });
});

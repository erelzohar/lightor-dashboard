import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { lightTick } from '../../lib/haptics';

/**
 * LT-313: the dashboard's segmented tabs (21st.dev "tabs", on Radix Tabs) —
 * every row of text buttons that switches what is shown. Adapted:
 * - the dashboard's colours instead of shadcn's tokens (no `bg-accent`,
 *   `text-muted-foreground`, `ring-ring` here): a soft grey track, the
 *   chosen tab on white (slate in dark mode) in the primary colour;
 * - Tailwind 3 spellings (`outline-none`, `data-[disabled]:`);
 * - the page's direction for the arrow keys (Radix assumes LTR);
 * - a light haptic tick when the tab changes (in the app; a browser gets none);
 * - `tabsListVariants` / `tabsTriggerVariants` exported, so a row that is a
 *   choice rather than a view (the notification channel: a radio group that
 *   saves) can look the same and keep its own semantics.
 */

export const tabsListVariants = cva('flex items-center shrink-0', {
  variants: {
    variant: {
      default: 'bg-gray-100 dark:bg-slate-800 p-1',
      button: '',
      line: 'border-b border-gray-200 dark:border-slate-700',
    },
    shape: {
      default: '',
      pill: '',
    },
    size: {
      lg: 'gap-2.5',
      md: 'gap-2',
      sm: 'gap-1.5',
      xs: 'gap-1',
    },
  },
  compoundVariants: [
    { variant: 'default', size: 'lg', className: 'p-1.5 gap-2.5' },
    { variant: 'default', size: 'md', className: 'p-1 gap-1' },
    { variant: 'default', size: 'sm', className: 'p-1 gap-1' },
    { variant: 'default', size: 'xs', className: 'p-1 gap-1' },
    { variant: 'default', shape: 'default', size: 'lg', className: 'rounded-xl' },
    { variant: 'default', shape: 'default', size: 'md', className: 'rounded-xl' },
    { variant: 'default', shape: 'default', size: 'sm', className: 'rounded-lg' },
    { variant: 'default', shape: 'default', size: 'xs', className: 'rounded-lg' },
    { variant: 'line', size: 'lg', className: 'gap-9' },
    { variant: 'line', size: 'md', className: 'gap-8' },
    { variant: 'line', size: 'sm', className: 'gap-4' },
    { variant: 'line', size: 'xs', className: 'gap-4' },
    { variant: 'default', shape: 'pill', className: 'rounded-full [&_[role=tab]]:rounded-full [&_[role=radio]]:rounded-full' },
    { variant: 'button', shape: 'pill', className: 'rounded-full [&_[role=tab]]:rounded-full [&_[role=radio]]:rounded-full' },
  ],
  defaultVariants: {
    variant: 'default',
    shape: 'pill',
    size: 'md',
  },
});

export const tabsTriggerVariants = cva(
  'shrink-0 cursor-pointer whitespace-nowrap inline-flex justify-center items-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-primary dark:data-[state=active]:text-violet-300 data-[state=active]:shadow-sm',
        button:
          'rounded-lg text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white',
        line: 'border-b-2 border-transparent text-gray-500 dark:text-slate-400 hover:text-primary data-[state=active]:border-primary data-[state=active]:text-primary',
      },
      size: {
        lg: 'gap-2.5 [&_svg]:size-5 text-sm',
        md: 'gap-1.5 [&_svg]:size-4 text-sm',
        sm: 'gap-1.5 [&_svg]:size-3.5 text-xs',
        xs: 'gap-1 [&_svg]:size-3.5 text-xs',
      },
    },
    compoundVariants: [
      { variant: 'default', size: 'lg', className: 'py-2.5 px-4 rounded-lg' },
      { variant: 'default', size: 'md', className: 'py-1.5 px-3.5 rounded-lg' },
      { variant: 'default', size: 'sm', className: 'py-1.5 px-2.5 rounded-md' },
      { variant: 'default', size: 'xs', className: 'py-1 px-2 rounded-md' },
      { variant: 'button', size: 'lg', className: 'py-3 px-4 rounded-lg' },
      { variant: 'button', size: 'md', className: 'py-2.5 px-3 rounded-lg' },
      { variant: 'button', size: 'sm', className: 'py-2 px-2.5 rounded-md' },
      { variant: 'button', size: 'xs', className: 'py-1.5 px-2 rounded-md' },
      { variant: 'line', size: 'lg', className: 'py-3' },
      { variant: 'line', size: 'md', className: 'py-2.5' },
      { variant: 'line', size: 'sm', className: 'py-2' },
      { variant: 'line', size: 'xs', className: 'py-1.5' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

const tabsContentVariants = cva('focus-visible:outline-none', {
  variants: { variant: { default: '' } },
  defaultVariants: { variant: 'default' },
});

type TabsContextType = {
  variant?: 'default' | 'button' | 'line' | null;
  size?: 'lg' | 'md' | 'sm' | 'xs' | null;
};
const TabsContext = React.createContext<TabsContextType>({ variant: 'default', size: 'md' });

const pageDir = (): 'ltr' | 'rtl' =>
  typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';

function Tabs({ className, onValueChange, dir, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  // Radix reports a press and the focus it brings as two changes to the same
  // tab: one tick, and one call, per real change.
  const last = React.useRef(props.value ?? props.defaultValue);
  // Back in step with the parent after each render (it may have kept the old tab).
  React.useEffect(() => { if (props.value !== undefined) last.current = props.value; });
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      dir={dir ?? pageDir()}
      className={cn(className)}
      onValueChange={(value) => {
        if (value === last.current) return;
        last.current = value;
        lightTick();
        onValueChange?.(value);
      }}
      {...props}
    />
  );
}

function TabsList({
  className,
  variant = 'default',
  shape = 'pill',
  size = 'md',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsContext.Provider value={{ variant: variant || 'default', size: size || 'md' }}>
      <TabsPrimitive.List data-slot="tabs-list" className={cn(tabsListVariants({ variant, shape, size }), className)} {...props} />
    </TabsContext.Provider>
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { variant, size } = React.useContext(TabsContext);
  return <TabsPrimitive.Trigger data-slot="tabs-trigger" className={cn(tabsTriggerVariants({ variant, size }), className)} {...props} />;
}

function TabsContent({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content> & VariantProps<typeof tabsContentVariants>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn(tabsContentVariants({ variant }), className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };

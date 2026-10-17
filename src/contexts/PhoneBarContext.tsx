import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * LT-380: the phone's tab bar, shared with the page under it. A page that
 * edits (the site editor) turns the bar into its own menu: its tabs go in
 * the bar's row (`rowEl`) and its panel in the part of the bar that grows
 * upwards (`panelEl`), through portals, so the page keeps owning their state.
 * "More" (LT-378) stays the way to the other pages; `menuOpen` lives here so
 * the editor can close it when one of its own tabs is tapped.
 */
export interface PhoneBarState {
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** A page has taken the bar over (the site editor on a phone). */
  editing: boolean;
  setEditing: (editing: boolean) => void;
  /** Where that page's tabs go, and its panel. Set by the bar. */
  rowEl: HTMLElement | null;
  panelEl: HTMLElement | null;
  setRowEl: (el: HTMLElement | null) => void;
  setPanelEl: (el: HTMLElement | null) => void;
}

const PhoneBarContext = createContext<PhoneBarState | null>(null);

export const PhoneBarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rowEl, setRowEl] = useState<HTMLElement | null>(null);
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null);
  const value = useMemo(
    () => ({ menuOpen, setMenuOpen, editing, setEditing, rowEl, panelEl, setRowEl, setPanelEl }),
    [menuOpen, editing, rowEl, panelEl]
  );
  return <PhoneBarContext.Provider value={value}>{children}</PhoneBarContext.Provider>;
};

/** The bar's shared state, or null outside the dashboard's layout (a page rendered alone). */
export const usePhoneBar = (): PhoneBarState | null => useContext(PhoneBarContext);

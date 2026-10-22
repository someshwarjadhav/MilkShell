import type * as React from "react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronsLeft, ChevronsRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { isActivePath, useNav, type NavSection } from "./nav";
import { Logo } from "../components/Illustrations";
import { cn } from "../lib/cn";
import { useData } from "../context/DataContext";
import { Tanker } from "../components/Illustrations";

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
}

const rowBase =
  "group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors";

export const Sidebar: React.FC<Props> = ({
  collapsed,
  onToggle,
  onNavigate,
  mobile,
}) => {
  const { dairyName } = useData();
  const { pathname } = useLocation();
  const sections = useNav();
  const slim = collapsed && !mobile;

  // Only one module is open at a time; the module of the open page opens by itself.
  const activeId =
    sections.find((s) => s.items.some((i) => isActivePath(i.to, pathname)))?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(activeId);
  useEffect(() => {
    if (activeId) setOpenId(activeId);
  }, [activeId]);

  const pillId = mobile ? "nav-pill-m" : "nav-pill";

  const renderSection = (s: NavSection) => {
    const Icon = s.icon;
    const isActive = s.id === activeId;

    // Module without children (Dashboard): a plain link.
    if (s.to) {
      return (
        <NavLink
          to={s.to}
          end={s.to === "/"}
          onClick={onNavigate}
          title={slim ? s.title : undefined}
          className={({ isActive: a }) =>
            cn(
              rowBase,
              slim && "justify-center px-0 py-3.5",
              a ? "text-brand" : "text-mute hover:bg-soft hover:text-ink",
            )
          }
        >
          {({ isActive: a }) => (
            <>
              {a && (
                <motion.span
                  layoutId={pillId}
                  className="absolute inset-0 rounded-2xl bg-brand/12"
                  transition={{ type: "spring", damping: 28, stiffness: 340 }}
                />
              )}
              <Icon size={19} className="relative shrink-0" />
              {!slim && <span className="relative truncate">{s.title}</span>}
            </>
          )}
        </NavLink>
      );
    }

    const open = !slim && openId === s.id;
    return (
      <>
        <button
          type="button"
          aria-expanded={open}
          title={slim ? s.title : undefined}
          onClick={() => {
            if (slim) {
              // The slim bar has no room for the sub menu: open the full bar on this module.
              setOpenId(s.id);
              onToggle();
              return;
            }
            setOpenId(open ? null : s.id);
          }}
          className={cn(
            rowBase,
            slim && "justify-center px-0 py-3.5",
            isActive ? "text-brand" : "text-mute hover:bg-soft hover:text-ink",
          )}
        >
          <Icon size={19} className="relative shrink-0" />
          {!slim && (
            <>
              <span className="relative flex-1 truncate text-left">{s.title}</span>
              <ChevronDown
                size={16}
                className={cn(
                  "relative shrink-0 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </>
          )}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.ul
              key="items"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="ml-[1.35rem] mt-0.5 space-y-0.5 overflow-hidden border-l border-line pl-2"
            >
              {s.items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.to === "/"}
                    onClick={onNavigate}
                    title={it.hint}
                    className={({ isActive: a }) =>
                      cn(
                        "relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors",
                        a ? "text-brand" : "text-mute hover:bg-soft hover:text-ink",
                      )
                    }
                  >
                    {({ isActive: a }) => (
                      <>
                        {a && (
                          <motion.span
                            layoutId={pillId}
                            className="absolute inset-0 rounded-xl bg-brand/12"
                            transition={{ type: "spring", damping: 28, stiffness: 340 }}
                          />
                        )}
                        <span
                          className={cn(
                            "relative h-1.5 w-1.5 shrink-0 rounded-full",
                            a ? "bg-brand" : "bg-mute/50",
                          )}
                        />
                        <span className="relative truncate">{it.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="flex h-full flex-col rounded-[2rem] border border-line bg-panel p-3 shadow-lift"
    >
      <div
        className={cn(
          "flex items-center gap-3 px-2 py-3",
          slim && "justify-center px-0",
        )}
      >
        <Logo size={slim ? 38 : 44} />
        {!slim && (
          <div className="min-w-0">
            <p className="font-display text-xl font-extrabold leading-none">
              Dhara
            </p>
            <p className="mt-1 truncate text-xs text-mute">{dairyName}</p>
          </div>
        )}
      </div>
      <ul
        className={cn(
          "mt-2 min-h-0 space-y-0.5 overflow-y-auto pr-1",
          slim ? "flex-1" : "flex-initial",
        )}
      >
        {sections.map((s) => (
          <li key={s.id}>{renderSection(s)}</li>
        ))}
      </ul>
      {!slim && (
        // The panel always fills the screen height. When the menu is short, this card takes the spare room
        // (up to a limit) and the tanker sits in the middle of it, so there is no empty gap.
        <div className="mt-3 flex min-h-[132px] max-h-56 shrink-0 grow flex-col overflow-hidden rounded-2xl bg-deep p-4 text-white">
          <div className="grid flex-1 place-items-center">
            <Tanker size={104} className="opacity-95" />
          </div>
          <div>
            <p className="text-sm font-semibold">Tanker leaves at 9:30</p>
            <p className="text-xs text-white/60">Check stock before dispatch.</p>
          </div>
        </div>
      )}
      {!mobile && (
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mt-3 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-mute hover:bg-soft hover:text-ink"
        >
          {collapsed ? (
            <ChevronsRight size={16} />
          ) : (
            <>
              <ChevronsLeft size={16} /> Collapse
            </>
          )}
        </button>
      )}
    </nav>
  );
};
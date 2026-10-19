import type * as React from 'react';
import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { useToast } from '../context/ToastContext';
import { getCenters, getMenuTree, getRawSessionData, getReportConfig, getSavedLoginRecord, getSessionErrors } from '../services/bootstrap';
import { routeFor } from '../services/menu/menu.service';
import { getSession } from '../services/session';
import { useLoginData } from '../hooks/useSessionData';

/** Secret-looking values are hidden before anything is shown or copied. */
const mask = (_k: string, v: unknown) => (/pass|token|jwt|secret|pwd/i.test(_k) ? '***' : v);
const text = (v: unknown, max = 5000) => {
  let s = '';
  try { s = JSON.stringify(v, mask, 1) ?? 'null'; } catch { s = String(v); }
  return s.length > max ? `${s.slice(0, max)}\n... (cut, ${s.length} characters in total)` : s;
};
/** The first rows of a reply are enough to see the key names. */
const head = (v: unknown, n = 3) => (Array.isArray(v) ? v.slice(0, n) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, Array.isArray(x) ? x.slice(0, n) : x])) : v);

/**
 * Shows what the three sign-in APIs returned and what the app understood from it,
 * so a wrong key name can be found without opening the browser console.
 */
export const SessionCheck: React.FC = () => {
  const toast = useToast();
  const profile = useLoginData();
  const [open, setOpen] = useState(false);
  const raw = getRawSessionData();
  const centers = getCenters();
  const menu = getMenuTree();
  const report = getReportConfig();
  const errs = getSessionErrors();

  const dump = useMemo(
    () => (open
      ? text({
          loginRecord: getSavedLoginRecord(),
          getCenter_reply: head(raw?.centers),
          getMenu_reply: head(raw?.menu),
          getReportAccess_reply: head(raw?.report, 4),
        }, 20000)
      : ''),
    [open, raw],
  );

  const rows: Array<[string, string, boolean]> = [
    ['User id (for getMenu / getReportAccess)', profile?.userId ?? 'NOT FOUND in login record', !!profile?.userId],
    ['Station id (for getCenter)', profile?.centerStationId ?? 'NOT FOUND in login record', !!profile?.centerStationId],
    ...(Object.keys(errs).length ? ([['Calls that failed', Object.entries(errs).map(([k, v]) => `${k}: ${v}`).join(' | '), false]] as Array<[string, string, boolean]>) : []),
    ['Centres from getCenter', `${centers.length}${centers.length ? '' : ' (using the VLC ids of the login record: ' + (getSession()?.vlccIds.length ?? 0) + ')'}`, centers.length > 0],
    ['Menu entries from getMenu', `${menu.length} top level, ${menu.filter((n) => routeFor(n) || n.children.some((c) => routeFor(c))).length} match a page of this app`, menu.some((n) => routeFor(n) || n.children.some((c) => routeFor(c)))],
    ['Report access rules', `${report.rules.size} report(s) with column rules: ${[...report.rules.keys()].join(', ') || 'none'}`, report.rules.size > 0],
  ];

  return (
    <Card className="self-start">
      <CardHeader
        title="Session check"
        subtitle="What the sign-in APIs returned and what this app understood. Send this to support if the centre list, menu or report columns look wrong."
        action={<Button variant="soft" size="sm" onClick={() => setOpen((o) => !o)}>{open ? 'Hide details' : 'Show details'}</Button>}
      />
      <ul className="divide-y divide-line/70 text-sm">
        {rows.map(([label, value, good]) => (
          <li key={label} className="flex items-start justify-between gap-4 px-5 py-3 sm:px-6">
            <span className="text-mute">{label}</span>
            <span className={`text-right font-semibold ${good ? 'text-ok' : 'text-danger'}`}>{value}</span>
          </li>
        ))}
      </ul>
      {open && (
        <div className="border-t border-line p-5 sm:p-6">
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="outline" icon={<Copy size={14} />} onClick={() => navigator.clipboard?.writeText(dump).then(() => toast('Copied'))}>Copy all</Button>
          </div>
          <pre className="max-h-[420px] overflow-auto rounded-2xl bg-soft p-4 text-xs leading-relaxed">{dump}</pre>
          <p className="mt-2 text-xs text-mute">Passwords and tokens are hidden. Nothing else is changed.</p>
        </div>
      )}
    </Card>
  );
};

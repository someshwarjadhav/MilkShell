import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { ErrorBlock, LoadingBlock } from '../../components/Widget';
import { ReportPage, Reveal } from '../../components/ReportKit';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../services/http/errors';
import { GLOBALS } from '../../lib/global';
import { refreshMenu } from '../../services/bootstrap';
import {
  buildAccessFormData,
  checkedKeys,
  getAccessMenu,
  getUser,
  postData,
  sameAccess,
  type AccessModule,
  type AccessUser,
} from '../../services/administrator/userAccess.api';

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const box = 'h-4 w-4 shrink-0 cursor-pointer rounded border-line accent-brand';

const UserAccess: React.FC = () => {
  const toast = useToast();

  const [users, setUsers] = useState<AccessUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userTick, setUserTick] = useState(0);
  const [userId, setUserId] = useState('');

  const [modules, setModules] = useState<AccessModule[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuTick, setMenuTick] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setUsersLoading(true);
    setUsersError(null);
    getUser()
      .then((u) => alive && setUsers(u))
      .catch((e) => alive && setUsersError(message(e, 'The user list could not be loaded.')))
      .finally(() => alive && setUsersLoading(false));
    return () => {
      alive = false;
    };
  }, [userTick]);

  const latest = useRef(0);
  useEffect(() => {
    if (!userId) {
      setModules([]);
      setSaved({});
      setError(null);
      setLoading(false);
      return;
    }
    const run = ++latest.current;
    setLoading(true);
    setError(null);
    getAccessMenu(userId)
      .then((m) => {
        if (run !== latest.current) return;
        setModules(m);
        setSaved(Object.fromEntries(m.flatMap((x) => x.forms.map((f) => [f.key, f.checked]))));
      })
      .catch((e) => {
        if (run !== latest.current) return;
        setModules([]);
        setSaved({});
        setError(message(e, 'The forms of this user could not be loaded.'));
      })
      .finally(() => {
        if (run === latest.current) setLoading(false);
      });
  }, [userId, menuTick]);

  const userOptions = useMemo(() => users.map((u) => ({ value: u.id, label: u.label })), [users]);
  const forms = useMemo(() => modules.flatMap((m) => m.forms), [modules]);
  const total = forms.length;
  const checkedCount = forms.filter((f) => f.checked).length;
  const allChecked = total > 0 && checkedCount === total;
  const someChecked = checkedCount > 0 && !allChecked;
  const changes = forms.filter((f) => f.checked !== saved[f.key]).length;

  const setForm = useCallback(
    (key: string, checked: boolean) =>
      setModules((ms) => ms.map((m) => ({ ...m, forms: m.forms.map((f) => (f.key === key ? { ...f, checked } : f)) }))),
    [],
  );
  const setAll = (checked: boolean) =>
    setModules((ms) => ms.map((m) => ({ ...m, forms: m.forms.map((f) => ({ ...f, checked })) })));

  const submit = async () => {
    if (!userId || saving || loading || error || !total) return;
    setSaving(true);
    try {
      const sent = checkedKeys(modules); 
      await postData(buildAccessFormData(userId, modules));

     
      const fresh = await getAccessMenu(userId);
      setModules(fresh);
      setSaved(Object.fromEntries(fresh.flatMap((x) => x.forms.map((f) => [f.key, f.checked]))));

      if (sameAccess(sent, checkedKeys(fresh))) {
        toast('User access saved successfully!');
      } else {
        toast('The server said saved, but the access did not change. Please check the save call.', 'warn');
      }
      if (GLOBALS.userid && GLOBALS.userid === userId) void refreshMenu(userId);
    } catch (e) {
      toast(message(e, 'The user access could not be saved'), 'warn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReportPage title="User Access">
      <Reveal delay={0.05}>
        <Card className="space-y-5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold">User</span>
            <div className="min-w-[14rem] flex-1">
              <SearchSelect
                value={userId}
                onChange={setUserId}
                options={userOptions}
                disabled={usersLoading || !!usersError || saving}
                placeholder={usersLoading ? 'Loading users…' : '-- select user --'}
                searchPlaceholder="Search name or email…"
                aria-label="User"
              />
            </div>
            <Button loading={saving} disabled={!userId || loading || !!error || !total || changes === 0} onClick={submit}>
              Submit
            </Button>
          </div>
          {usersError && <ErrorBlock compact message={usersError} onRetry={() => setUserTick((t) => t + 1)} />}
         
          {!userId ? (
            <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-line px-6 py-14 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/12 text-brand">
                <ShieldCheck size={22} />
              </span>
              <p className="text-sm text-mute">Select a user to see and change the forms they can access.</p>
            </div>
          ) : loading ? (
            <LoadingBlock height="h-64" label="Loading the forms of this user…" />
          ) : error ? (
            <ErrorBlock message={error} onRetry={() => setMenuTick((t) => t + 1)} />
          ) : total === 0 ? (
            <p className="px-1 py-8 text-center text-sm text-mute">The portal returned no forms for this user.</p>
          ) : (
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-line">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-soft text-left">
                  <tr>
                    <th className="w-1/3 border-b border-line px-4 py-3 font-bold">Module</th>
                    <th className="border-b border-line px-4 py-3 font-bold">Form</th>
                    <th className="w-28 border-b border-line px-4 py-3 text-center font-bold">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        Access
                        <input
                          type="checkbox"
                          className={box}
                          checked={allChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = someChecked;
                          }}
                          onChange={(e) => setAll(e.target.checked)}
                          aria-label="Select all forms"
                        />
                      </label>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) =>
                    m.forms.map((f, i) => (
                      <tr key={f.key} className="border-t border-line hover:bg-brand/[0.05]">
                        {i === 0 && (
                          <td rowSpan={m.forms.length} className="border-r border-line px-4 py-2.5 align-top font-semibold">
                            {m.name}
                          </td>
                        )}
                        <td className="px-4 py-2.5">
                          <label htmlFor={`acc-${f.key}`} className="block cursor-pointer">
                            {f.name}
                          </label>
                        </td>
                        <td className="border-l border-line px-4 py-2.5 text-center">
                          <input
                            id={`acc-${f.key}`}
                            type="checkbox"
                            className={box}
                            checked={f.checked}
                            onChange={(e) => setForm(f.key, e.target.checked)}
                          />
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default UserAccess;
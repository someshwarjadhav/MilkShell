import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Save } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Field, Input } from "./ui/Fields";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../services/http/errors";
import { vlccCode } from "../services/vlcc/names";
import {
  emptyProfile,
  getProfileFromSession,
  getVillageInfo,
  updateProfile,
  validateProfile,
  type Profile,
  type ProfileErrors,
} from "../services/profile/profile.api";
import { initials } from "../lib/format";

/**
 * Profile settings (SmartX "profileupdate"): username, MCC name, email, mobile, address, GST, logo and a new password.
 * Opened from the account menu in the top bar.
 */
export const ProfileModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [p, setP] = useState<Profile>(emptyProfile());
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");
  const file = useRef<HTMLInputElement>(null);

  // fill the form from the saved login, then refresh it from the server
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const fallback: Partial<Profile> = {
      id: user?.userId ?? "",
      username: user?.name ?? "",
      email: user?.email ?? "",
      mccname: user?.dairyName ?? "",
    };
    const saved = getProfileFromSession(fallback);
    setP({ ...saved, password: "", logo: null });
    setErrors({});
    setPreview("");
    if (saved.id) {
      setLoading(true);
      getVillageInfo(saved.id, saved)
        .then((fresh) => alive && setP({ ...fresh, password: "", logo: null }))
        .catch(() => undefined)
        .finally(() => alive && setLoading(false));
    }
    return () => {
      alive = false;
    };
  }, [open, user]);

  useEffect(
    () => () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setErrors((e) => {
      if (!e[k as string]) return e;
      const { [k as string]: _gone, ...rest } = e;
      return rest;
    });
  };

  const save = async () => {
    if (saving) return;
    const found = validateProfile(p);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const msg = await updateProfile(p);
      toast(msg);
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "The profile could not be updated.", "warn");
    } finally {
      setSaving(false);
    }
  };

  const shownLogo = preview || p.logoUrl;
  const ids = p.SessionID
    ? p.SessionID.split(/[,;\s]+/)
        .filter(Boolean)
        .map(vlccCode)
        .join(", ")
    : "";
  const err = (k: string) => (errors[k] ? <span className="mt-1 block text-xs text-danger">{errors[k]}</span> : null);

  // drawn on <body>: the top bar has a blur filter, which would trap a fixed panel inside the bar
  return createPortal(
    <Modal
      open={open}
      onClose={() => (saving ? undefined : onClose())}
      title="Profile settings"
      subtitle={loading ? "Loading your profile…" : "Update your dairy details"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<Save size={15} />} loading={saving} onClick={() => void save()}>
            Save changes
          </Button>
        </>
      }
    >
      <div
        className="grid gap-4 sm:grid-cols-2"
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "file") {
            e.preventDefault();
            void save();
          }
        }}
      >
        <div className="flex items-center gap-4 sm:col-span-2">
          {shownLogo ? (
            <img src={shownLogo} alt="Logo" className="h-16 w-16 rounded-2xl border border-line object-cover" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-deep font-display text-xl font-extrabold text-white dark:bg-brand dark:text-[#06222a]">
              {initials(p.username || user?.name || "U")}
            </span>
          )}
          <div className="min-w-0">
            <input
              ref={file}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                set("logo", f);
                setPreview(f ? URL.createObjectURL(f) : "");
              }}
            />
            <Button variant="soft" size="sm" icon={<ImagePlus size={14} />} onClick={() => file.current?.click()}>
              {p.logo ? "Change logo" : "Upload logo"}
            </Button>
            <p className="mt-1 truncate text-xs text-mute">{p.logo ? p.logo.name : "PNG or JPG, up to 2 MB"}</p>
            {err("logo")}
          </div>
        </div>

        <Field label="Username">
          <Input value={p.username} onChange={(e) => set("username", e.target.value)} />
          {err("username")}
        </Field>
        <Field label="MCC / Dairy name">
          <Input value={p.mccname} onChange={(e) => set("mccname", e.target.value)} />
          {err("mccname")}
        </Field>
        <Field label="Email">
          <Input type="email" value={p.email} onChange={(e) => set("email", e.target.value)} />
          {err("email")}
        </Field>
        <Field label="Mobile">
          <Input
            inputMode="numeric"
            maxLength={10}
            value={p.mobile}
            onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
          {err("mobile")}
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input value={p.Address} onChange={(e) => set("Address", e.target.value)} />
        </Field>
        <Field label="GST number">
          <Input
            value={p.GST}
            maxLength={15}
            onChange={(e) => set("GST", e.target.value.toUpperCase())}
          />
          {err("GST")}
        </Field>
        <Field label="New password" hint="Leave empty to keep the current password">
          <Input
            type="password"
            autoComplete="new-password"
            value={p.password}
            onChange={(e) => set("password", e.target.value)}
          />
          {err("password")}
        </Field>
        {ids && (
          <p className="rounded-2xl bg-soft px-4 py-3 text-xs sm:col-span-2">
            <span className="text-mute">Your VLC ids</span>
            <br />
            <b className="break-words">{ids}</b>
          </p>
        )}
      </div>
    </Modal>,
    document.body,
  );
};

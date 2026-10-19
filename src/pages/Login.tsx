import type * as React from "react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  Cpu,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Logo, AnimalHead } from "../components/Illustrations";
import { MilkTank } from "../components/MilkTank";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Fields";
import { DEV_EMAIL, DEV_PASSWORD } from '../services/config';

const Login: React.FC = () => {
  const { login } = useAuth();
  // In `npm run dev` the form is pre-filled from VITE_DEV_EMAIL / VITE_DEV_PASSWORD (.env.local). Never in a production build.
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await login(email.trim(), password);
   
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
    }
  };

  return (
    <div className="grid  min-h-dvh lg:grid-cols-[minmax(420px,1fr)_1.15fr]">
      <div className="flex flex-col justify-between px-6 py-8 sm:px-12">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <p className="font-display text-2xl font-extrabold">Dhara</p>
        </div>
        <motion.form
          onSubmit={submit}
          className="mx-auto w-full max-w-sm py-10"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
            Every litre, counted at the source
          </h1>
          <p className="mt-3 text-mute">
            Sign in to see what your centres collected this morning, farmer by
            farmer.
          </p>
          <div className="mt-8 space-y-4">
            <Field label="Email">
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail size={16} />}
                placeholder="you@example.com"
                required
                disabled={busy}
                className="text-base sm:text-sm"
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock size={16} />}
                  placeholder="••••••••"
                  required
                  disabled={busy}
                  className="pr-10 text-base sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
              >
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={busy} className="w-full">
              Sign in
            </Button>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm font-semibold">
              <Link to="/contact" className="text-mute hover:text-brand">
                Contact support
              </Link>
            </div>
          </div>
        </motion.form>
        <p className="text-xs text-mute">
          © {new Date().getFullYear()} Dhara Dairy
        </p>
      </div>

      <div className="relative hidden overflow-hidden bg-deep text-white lg:block">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(600px 420px at 70% 20%, rgba(20,150,155,.55), transparent 65%), radial-gradient(500px 360px at 10% 90%, rgba(247,223,160,.18), transparent 60%)",
          }}
        />
        <div className="relative grid h-full place-items-center p-12">
          <div className="relative">
            <MilkTank
              percent={72}
              height={420}
              color="#38BEC3"
              track="rgba(255,255,255,.08)"
              outline="rgba(255,255,255,.35)"
            />
            <motion.div
              className="absolute -left-40 top-10 w-52 rounded-3xl bg-white/10 p-4 backdrop-blur-md"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center gap-2">
                <Cpu size={16} />
                <span className="text-sm font-semibold">Milk analyzer</span>
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold">
                Fat · SNF · CLR
              </p>
              <p className="text-sm text-white/70">Measured at every can</p>
            </motion.div>
            <motion.div
              className="absolute -right-44 top-40 w-56 rounded-3xl bg-white/10 p-4 backdrop-blur-md"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 }}
            >
              <div className="flex items-center gap-2">
                <Smartphone size={16} />
                <span className="text-sm font-semibold">Collector app</span>
              </div>
              <div className="mt-2 flex -space-x-2">
                {(["cow", "buffalo", "goat"] as const).map((t) => (
                  <AnimalHead
                    key={t}
                    type={t}
                    size={34}
                    className="rounded-full ring-2 ring-deep"
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-white/70">
                Cow, buffalo and mix, kept apart.
              </p>
            </motion.div>
            <motion.div
              className="absolute -bottom-2 -left-24 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-deep shadow-pop"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              <ShieldCheck size={18} className="text-ok" />
              <span className="text-sm font-bold">Live from SmartX</span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

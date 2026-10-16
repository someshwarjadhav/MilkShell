import type * as React from 'react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Logo } from '../components/Illustrations';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Fields';
import { useAuth } from '../context/AuthContext';

const CreateAccount: React.FC = () => {
  const { createAccount } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Use at least 8 characters for the demo password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match. Check both fields and try again.');
      return;
    }
    if (!createAccount(name, email)) {
      setError('Enter your name and a valid email address to create the demo profile.');
      return;
    }

    navigate('/', { replace: true });
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-mute hover:text-brand">
          <ArrowLeft size={16} /> Back to sign in
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-line bg-panel shadow-lift">
          <div className="bg-deep px-6 py-7 text-white sm:px-9">
            <div className="flex items-center gap-3"><Logo size={44} /><p className="font-display text-2xl font-extrabold">Dhara</p></div>
            <h1 className="mt-6 font-display text-3xl font-extrabold sm:text-4xl">Create your account</h1>
            <p className="mt-2 max-w-xl text-sm text-white/75">Set up a local demo profile to explore the dairy collection dashboard.</p>
          </div>

          <form onSubmit={submit} className="space-y-5 p-6 sm:p-9">
            <div className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink">
              <b>Demo account only.</b> This prototype has no authentication backend. The profile is saved in this browser; do not enter a real or sensitive password.
            </div>

            <Field label="Full name">
              <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" icon={<UserRound size={16} />} placeholder="Your name" minLength={2} required />
            </Field>
            <Field label="Email address">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" icon={<Mail size={16} />} placeholder="you@example.com" required />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Password" hint="At least 8 characters for this demo profile">
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" icon={<LockKeyhole size={16} />} minLength={8} required />
              </Field>
              <Field label="Confirm password">
                <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" icon={<LockKeyhole size={16} />} minLength={8} required />
              </Field>
            </div>

            {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
            <Button type="submit" size="lg" className="w-full">Create demo account</Button>
            <p className="text-center text-sm text-mute">Already have a profile? <Link to="/login" className="font-semibold text-brand hover:underline">Sign in</Link></p>
          </form>
        </section>

        <p className="mt-5 text-center text-xs text-mute">Profile details are stored only in this browser's local storage.</p>
      </div>
    </main>
  );
};

export default CreateAccount;

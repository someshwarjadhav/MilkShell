import type * as React from 'react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Mail, MessageSquareText, Phone, Send } from 'lucide-react';
import { Logo } from '../components/Illustrations';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Fields';
import { useAuth } from '../context/AuthContext';

const Contact: React.FC = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [subject, setSubject] = useState('Account and access');
  const [message, setMessage] = useState('');
  const [showTemporaryError, setShowTemporaryError] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setShowTemporaryError(true);
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to={user ? '/' : '/login'} className="inline-flex items-center gap-2 text-sm font-semibold text-mute hover:text-brand">
            <ArrowLeft size={16} /> {user ? 'Back to dashboard' : 'Back to sign in'}
          </Link>
          <Link to="/login" className="flex items-center gap-2 text-sm font-bold text-ink"><Logo size={34} /> Dhara support</Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className="rounded-[2rem] bg-deep p-6 text-white sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white"><MessageSquareText size={22} /></span>
            <p className="mt-5 text-sm font-semibold text-white/65">Dhara dairy cloud</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">Contact support</h1>
            <p className="mt-4 text-sm leading-6 text-white/75">Use this form to prepare a support request. Message delivery becomes available after the dairy connects a support backend.</p>
            <div className="mt-7 rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="flex items-start gap-3"><Phone size={18} className="mt-0.5 shrink-0 text-brand" /><div><p className="font-semibold">Need urgent help?</p><p className="mt-1 text-sm text-white/65">Please call your dairy administrator using the phone number your organization has provided.</p></div></div>
            </div>
            <div className="mt-4 flex items-start gap-3 text-sm text-white/70"><Mail size={17} className="mt-0.5 shrink-0" /><p>Do not include passwords, payment details, or other sensitive information in this demo form.</p></div>
          </section>

          <section className="rounded-[2rem] border border-line bg-panel p-6 shadow-lift sm:p-8">
            <h2 className="font-display text-2xl font-extrabold">Send a message</h2>
            <p className="mt-1 text-sm text-mute">Fields are checked in your browser. The form does not send data to a server.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name"><Input value={name} onChange={(event) => { setName(event.target.value); setShowTemporaryError(false); }} autoComplete="name" required /></Field>
                <Field label="Email address"><Input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setShowTemporaryError(false); }} autoComplete="email" required /></Field>
              </div>
              <Field label="Topic">
                <Select value={subject} onChange={(event) => { setSubject(event.target.value); setShowTemporaryError(false); }}>
                  <option>Account and access</option>
                  <option>Collections and farmers</option>
                  <option>Billing and reports</option>
                  <option>Devices and syncing</option>
                  <option>Other</option>
                </Select>
              </Field>
              <Field label="Message"><textarea value={message} onChange={(event) => { setMessage(event.target.value); setShowTemporaryError(false); }} rows={6} maxLength={1500} placeholder="Tell us what you need help with…" required className="w-full resize-y rounded-xl border border-line bg-panel px-3 py-2.5 text-sm text-ink placeholder:text-mute/70 transition-colors hover:border-brand/50 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15" /></Field>

              {showTemporaryError && (
                <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-ink">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" />
                  <div><p className="font-bold text-danger">Temporary error — message not sent</p><p className="mt-1">The support backend is not connected yet, so your message could not be delivered. Please try again later or call your dairy administrator. Your message has not been saved or sent.</p></div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-xs text-mute">{message.length}/1500 characters</span>
                <Button type="submit" icon={<Send size={15} />}>Send message</Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
};

export default Contact;

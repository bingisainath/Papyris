// src/components/organisms/ProfileModal/index.tsx
// Your profile, edited like in messaging apps: tap the photo to change it, tap a field to edit it.
// Each field saves on its own, so a problem with one (e.g. a taken username) never loses the others.

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { AtSign, BadgeCheck, CalendarDays, Camera, Check, Image as ImageIcon, Info, Mail, Pencil, Trash2, User as UserIcon, X, Wallet, CreditCard, IndianRupee } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from '../../atoms';
import { useAuth } from '../../../app/AuthProvider';
import { mediaService } from '../../../services/media.service';
import { parseApiError } from '../../../utils/apiError';
import { mediaTypeOf, resolveMediaUrl, validateFile } from '../../../utils/media';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void; // e.g. refresh chats, where your name and photo appear
}

const USERNAME_RE = /^[a-z0-9._]{3,30}$/;

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onChanged }) => {
  const { user, updateProfile } = useAuth();
  const [photoMenu, setPhotoMenu] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (viewPhoto) setViewPhoto(false);
      else if (photoMenu) setPhotoMenu(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, photoMenu, viewPhoto]);

  if (!isOpen || !user) return null;

  const save = async (patch: Parameters<typeof updateProfile>[0], done: string) => {
    await updateProfile(patch);
    toast.success(done);
    onChanged?.();
  };

  const uploadPhoto = async (file: File | undefined) => {
    setPhotoMenu(false);
    if (!file) return;
    const problem = validateFile(file) || (mediaTypeOf(file) !== 'image' ? 'Choose an image' : null);
    if (problem) {
      toast.error(problem);
      return;
    }
    setPhotoBusy(true);
    try {
      const uploaded = await mediaService.upload(file);
      await save({ avatar: uploaded.url }, 'Profile photo updated');
    } catch (error) {
      toast.error(`Couldn't update the photo: ${parseApiError(error)}`);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoMenu(false);
    setPhotoBusy(true);
    try {
      await save({ avatar: '' }, 'Profile photo removed');
    } catch (error) {
      toast.error(parseApiError(error));
    } finally {
      setPhotoBusy(false);
    }
  };

  const displayName = user.name || user.username;
  const joined = user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Profile"
        className="w-full sm:max-w-md h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col bg-white sm:rounded-2xl shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-muted-200">
          <h2 className="text-lg font-semibold text-muted-900">Profile</h2>
          <button type="button" onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-muted-100" aria-label="Close">
            <X className="w-5 h-5 text-muted-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Photo */}
          <div className="flex flex-col items-center px-6 pt-8 pb-6 bg-muted-50 border-b border-muted-200">
            <div className="relative">
              <button
                type="button"
                onClick={() => user.avatar && setViewPhoto(true)}
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label={user.avatar ? 'View profile photo' : 'Profile photo'}
              >
                <Avatar src={user.avatar} alt={displayName} size="3xl" />
              </button>
              {photoBusy && (
                <span className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <span className="w-7 h-7 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                </span>
              )}
              <button
                type="button"
                onClick={() => setPhotoMenu((open) => !open)}
                disabled={photoBusy}
                aria-label="Change profile photo"
                aria-expanded={photoMenu}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary-700 hover:bg-primary-800 text-white flex items-center justify-center ring-4 ring-muted-50 disabled:opacity-60"
              >
                <Camera className="w-4 h-4" />
              </button>
              {photoMenu && (
                <div role="menu" className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 w-48 py-1 bg-white border border-muted-200 rounded-xl shadow-elevated">
                  <MenuItem icon={ImageIcon} label={user.avatar ? 'Upload new photo' : 'Upload photo'} onClick={() => fileRef.current?.click()} />
                  {user.avatar && <MenuItem icon={Trash2} label="Remove photo" danger onClick={removePhoto} />}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
            <p className="mt-4 text-xl font-semibold text-muted-900">{displayName}</p>
            <p className="text-sm text-muted-500">@{user.username}</p>
          </div>

          {/* Editable fields */}
          <div className="divide-y divide-muted-100">
            <EditableField
              icon={UserIcon}
              label="Name"
              help="Shown to people you chat with."
              value={user.name || ''}
              placeholder="Add your name"
              maxLength={100}
              validate={(v) => (v.trim().length < 2 ? 'Enter at least 2 characters' : null)}
              onSave={(name) => save({ name }, 'Name updated')}
            />
            <EditableField
              icon={Info}
              label="About"
              help="A short line about you, like a status."
              value={user.bio || ''}
              placeholder="Hey there! I'm using Papyris."
              maxLength={140}
              multiline
              onSave={(bio) => save({ bio }, 'About updated')}
            />
            <EditableField
              icon={AtSign}
              label="Username"
              help="People can find you by it. Lowercase letters, numbers, dots and underscores."
              value={user.username}
              prefix="@"
              maxLength={30}
              normalize={(v) => v.trim().toLowerCase()}
              validate={(v) => (USERNAME_RE.test(v) ? null : 'Use 3-30 lowercase letters, numbers, dots or underscores')}
              onSave={(username) => save({ username }, 'Username updated')}
            />
          </div>

          {/* Payment details: a "Pay" button for people who owe you opens these with the amount */}
          <div className="mt-2 border-t border-muted-200">
            <p className="px-6 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-500">Payment details</p>
            <p className="px-6 pb-2 text-xs text-muted-500">Optional. People in your chats who owe you see a Pay button for these. Papyris never moves money.</p>
            <div className="divide-y divide-muted-100">
              <EditableField
                icon={Wallet}
                label="Revolut username"
                help="From revolut.me/your-name"
                value={user.payment_handles?.revolut || ''}
                placeholder="your-name"
                prefix="revolut.me/"
                maxLength={40}
                normalize={(v) => v.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?revolut\.me\//i, '')}
                validate={(v) => (!v || /^[A-Za-z0-9._-]{2,40}$/.test(v) ? null : 'Letters, numbers, dots, dashes or underscores')}
                onSave={(revolut) => save({ payment_handles: { revolut } }, 'Revolut saved')}
              />
              <EditableField
                icon={CreditCard}
                label="PayPal.me username"
                help="From paypal.me/your-name"
                value={user.payment_handles?.paypal || ''}
                placeholder="YourName"
                prefix="paypal.me/"
                maxLength={40}
                normalize={(v) => v.trim().replace(/^https?:\/\/(www\.)?paypal\.me\//i, '')}
                validate={(v) => (!v || /^[A-Za-z0-9]{1,40}$/.test(v) ? null : 'Letters and numbers only')}
                onSave={(paypal) => save({ payment_handles: { paypal } }, 'PayPal saved')}
              />
              <EditableField
                icon={IndianRupee}
                label="UPI ID"
                help="For payments in rupees, like name@okbank"
                value={user.payment_handles?.upi || ''}
                placeholder="name@bank"
                maxLength={100}
                normalize={(v) => v.trim()}
                validate={(v) => (!v || /^[A-Za-z0-9._-]{2,64}@[A-Za-z0-9]{2,32}$/.test(v) ? null : 'Looks like name@bank')}
                onSave={(upi) => save({ payment_handles: { upi } }, 'UPI ID saved')}
              />
            </div>
          </div>

          {/* Account details (not editable here) */}
          <div className="mt-2 border-t border-muted-200 divide-y divide-muted-100">
            <InfoRow icon={Mail} label="Email" value={user.email}>
              {user.email_verified !== false && (
                <span className="inline-flex items-center gap-1 text-xs text-success-700">
                  <BadgeCheck className="w-3.5 h-3.5" /> Verified
                </span>
              )}
            </InfoRow>
            {joined && <InfoRow icon={CalendarDays} label="Joined" value={joined} />}
          </div>
        </div>
      </div>

      {viewPhoto && user.avatar && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setViewPhoto(false); }}>
          <img src={resolveMediaUrl(user.avatar)} alt={displayName} className="max-w-[min(90vw,32rem)] max-h-[80vh] rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{ icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }> = ({ icon: Icon, label, onClick, danger }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted-50 ${danger ? 'text-accent-600' : 'text-muted-800'}`}
  >
    <Icon className="w-4 h-4" /> {label}
  </button>
);

const InfoRow: React.FC<{ icon: LucideIcon; label: string; value: string; children?: React.ReactNode }> = ({ icon: Icon, label, value, children }) => (
  <div className="flex items-start gap-4 px-6 py-4">
    <Icon className="w-5 h-5 mt-0.5 text-primary-700 flex-shrink-0" strokeWidth={1.75} />
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-500">{label}</p>
      <p className="text-sm text-muted-900 truncate">{value}</p>
      {children}
    </div>
  </div>
);

/** A profile field shown as text; the pencil turns it into an input with Save/Cancel. */
const EditableField: React.FC<{
  icon: LucideIcon;
  label: string;
  help: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  multiline?: boolean;
  prefix?: string;
  normalize?: (value: string) => string;
  validate?: (value: string) => string | null;
  onSave: (value: string) => Promise<void>;
}> = ({ icon: Icon, label, help, value, placeholder, maxLength, multiline, prefix, normalize, validate, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const cancel = () => { setEditing(false); setDraft(value); setError(null); };

  const submit = async () => {
    const next = normalize ? normalize(draft) : draft.trim();
    if (next === value) { cancel(); return; }
    const problem = validate?.(next) || null;
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(parseApiError(err)); // e.g. "Username is already taken": stay in edit mode
    } finally {
      setSaving(false);
    }
  };

  const inputProps = {
    value: draft,
    autoFocus: true,
    maxLength,
    placeholder,
    disabled: saving,
    'aria-label': label,
    'aria-invalid': !!error,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setDraft(e.target.value); setError(null); },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
      if (e.key === 'Enter' && (!multiline || !e.shiftKey)) { e.preventDefault(); submit(); }
    },
    className: 'flex-1 min-w-0 bg-transparent outline-none text-sm text-muted-900 placeholder:text-muted-400 resize-none',
  };

  return (
    <div className="flex items-start gap-4 px-6 py-4">
      <Icon className="w-5 h-5 mt-0.5 text-primary-700 flex-shrink-0" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-500">{label}</p>
        {editing ? (
          <>
            <div className={`mt-1 flex items-start gap-1 px-3 py-2 rounded-lg border bg-white ${error ? 'border-accent-500' : 'border-primary-500 ring-2 ring-primary-100'}`}>
              {prefix && <span className="text-sm text-muted-400">{prefix}</span>}
              {multiline ? <textarea rows={2} {...inputProps} /> : <input {...inputProps} />}
              <span className="text-[11px] text-muted-400 tabular-nums self-end">{maxLength - draft.length}</span>
            </div>
            {error ? <p className="mt-1 text-xs text-accent-600">{error}</p> : <p className="mt-1 text-xs text-muted-500">{help}</p>}
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-primary-700 hover:bg-primary-800 text-white disabled:opacity-60">
                <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={cancel} disabled={saving} className="px-3 py-1.5 text-sm rounded-lg text-muted-700 hover:bg-muted-100">Cancel</button>
            </div>
          </>
        ) : (
          <p className={`text-sm break-words ${value ? 'text-muted-900' : 'text-muted-400'}`}>
            {value ? `${prefix || ''}${value}` : placeholder}
          </p>
        )}
      </div>
      {!editing && (
        <button type="button" onClick={() => setEditing(true)} className="p-2 -mr-2 rounded-lg text-primary-700 hover:bg-primary-50" aria-label={`Edit ${label.toLowerCase()}`}>
          <Pencil className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default ProfileModal;

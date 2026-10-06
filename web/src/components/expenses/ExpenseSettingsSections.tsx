// src/components/expenses/ExpenseSettingsSections.tsx
// Settings page: receipt-scanning model and own API keys, store discounts, and (app admins) model management.
// API keys are write-only: once saved, only the last 4 characters ever come back.

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { expenseService } from '../../services/expense.service';
import type { AdminAI, AISettings, AIModelOption, StoreDiscount } from '../../services/expense.service';
import { parseApiError } from '../../utils/apiError';
import { Switch } from './shared';

const PROVIDERS: { id: 'anthropic' | 'openai'; name: string; hint: string; url: string }[] = [
  { id: 'anthropic', name: 'Claude (Anthropic)', hint: 'sk-ant-…', url: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', name: 'OpenAI', hint: 'sk-…', url: 'https://platform.openai.com/api-keys' },
];

export const ReceiptScanningSettings: React.FC = () => {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [keyDraft, setKeyDraft] = useState<{ provider: 'anthropic' | 'openai'; value: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    expenseService.aiSettings().then(setSettings).catch((e) => toast.error(parseApiError(e)));
  }, []);

  const run = async (action: () => Promise<AISettings>, done: string) => {
    setBusy(true);
    try {
      setSettings(await action());
      toast.success(done);
    } catch (error) {
      toast.error(parseApiError(error));
    } finally {
      setBusy(false);
    }
  };

  if (!settings) return null;
  const { usage } = settings;

  return (
    <>
    <div className="card p-4 sm:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-muted-900">Receipt scanning</h2>
        <p className="text-sm text-muted-500">
          {usage.scans_this_month} of {usage.monthly_limit} free scans used this month. Scans with your own key don’t count.
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-muted-700">AI model</span>
        <select
          value={settings.preferred_model_id ?? ''}
          disabled={busy}
          onChange={(e) => run(() => expenseService.setPreferredModel(e.target.value ? Number(e.target.value) : null), 'Model saved')}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-muted-300 bg-white"
        >
          <option value="">App default ({settings.models.find((m) => m.is_default)?.label || 'none'})</option>
          {settings.models.map((m) => (
            <option key={m.id} value={m.id} disabled={!m.available}>
              {m.label}{m.available ? '' : ' (add a key to use)'}
            </option>
          ))}
        </select>
        <span className="block mt-1 text-xs text-muted-500">A group admin can also pick a model for one chat.</span>
      </label>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-700">Your own API keys (optional)</p>
        {PROVIDERS.map((p) => {
          const saved = settings.keys[p.id];
          const editing = keyDraft?.provider === p.id;
          return (
            <div key={p.id} className="p-3 rounded-xl border border-muted-200">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-900">{p.name}</p>
                  <p className="text-xs text-muted-500">{saved ? `Saved key ${saved}` : 'Not added'}</p>
                </div>
                {saved ? (
                  <button type="button" disabled={busy} onClick={() => run(() => expenseService.removeOwnKey(p.id), 'Key removed')} className="text-sm text-accent-600 hover:underline">
                    Remove
                  </button>
                ) : !editing && (
                  <button type="button" onClick={() => setKeyDraft({ provider: p.id, value: '' })} className="text-sm text-primary-700 hover:underline">Add key</button>
                )}
              </div>
              {editing && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => expenseService.setOwnKey(p.id, keyDraft!.value.trim()), 'Key saved').then(() => setKeyDraft(null));
                  }}
                >
                  <input
                    type="password"
                    autoComplete="off"
                    value={keyDraft!.value}
                    onChange={(e) => setKeyDraft({ provider: p.id, value: e.target.value })}
                    placeholder={p.hint}
                    aria-label={`${p.name} API key`}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-muted-300 font-mono text-sm"
                  />
                  <button type="submit" disabled={busy || keyDraft!.value.trim().length < 20} className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm disabled:opacity-50">Save</button>
                  <button type="button" onClick={() => setKeyDraft(null)} className="px-2 text-sm text-muted-500">Cancel</button>
                </form>
              )}
              {editing && (
                <p className="mt-1 text-xs text-muted-500">
                  Create one at <a href={p.url} target="_blank" rel="noreferrer" className="text-primary-700 underline">{p.url.replace('https://', '')}</a>.
                  It’s stored encrypted, used only on our server, and billed to your account.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
    {settings.is_app_admin && <AdminAISettings />}
    </>
  );
};

const emptyRule = { store_name: '', percent: '10', excluded_categories: [] as string[], stacks_with_reduced: false, active: true };

export const StoreDiscountSettings: React.FC = () => {
  const [rules, setRules] = useState<StoreDiscount[]>([]);
  const [draft, setDraft] = useState<(typeof emptyRule & { id?: number; excluded: string }) | null>(null);

  const load = useCallback(() => {
    expenseService.storeDiscounts().then(setRules).catch((e) => toast.error(parseApiError(e)));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!draft) return;
    try {
      await expenseService.saveStoreDiscount({
        store_name: draft.store_name,
        percent: draft.percent,
        excluded_categories: draft.excluded.split(',').map((s) => s.trim()).filter(Boolean),
        stacks_with_reduced: draft.stacks_with_reduced,
        active: draft.active,
      }, draft.id);
      setDraft(null);
      load();
    } catch (error) {
      toast.error(parseApiError(error));
    }
  };

  return (
    <div className="card p-4 sm:p-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-muted-900">Store discounts</h2>
          <p className="text-sm text-muted-500">
            E.g. a staff or member discount at one shop. When it isn’t printed on a receipt we add it switched off, so you can turn it on.
          </p>
        </div>
        {!draft && (
          <button type="button" onClick={() => setDraft({ ...emptyRule, excluded: '' })} className="flex-shrink-0 px-3 py-1.5 text-sm rounded-lg bg-primary-50 text-primary-700">Add</button>
        )}
      </div>

      {rules.map((r) => (
        <div key={r.id} className="flex items-center gap-3 py-2 border-b border-muted-100">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-muted-900">{r.store_name} · {r.percent}%</p>
            <p className="text-xs text-muted-500">
              {r.stacks_with_reduced ? 'Also on reduced items' : 'Not on reduced items'}
              {r.excluded_categories.length > 0 && ` · not on ${r.excluded_categories.join(', ')}`}
            </p>
          </div>
          <Switch
            checked={r.active}
            label={`${r.store_name} discount active`}
            onChange={(active) => expenseService.saveStoreDiscount({ ...r, active }, r.id).then(load).catch((e) => toast.error(parseApiError(e)))}
          />
          <button type="button" onClick={() => setDraft({ ...r, excluded: r.excluded_categories.join(', ') })} className="text-sm text-primary-700">Edit</button>
          <button type="button" onClick={() => expenseService.deleteStoreDiscount(r.id).then(load).catch((e) => toast.error(parseApiError(e)))} className="text-sm text-accent-600">Delete</button>
        </div>
      ))}

      {draft && (
        <div className="p-3 rounded-xl border border-muted-200 space-y-2">
          <div className="flex gap-2">
            <input value={draft.store_name} onChange={(e) => setDraft({ ...draft, store_name: e.target.value })} placeholder="Store, e.g. Tesco" aria-label="Store" className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-muted-300" />
            <input value={draft.percent} inputMode="decimal" onChange={(e) => setDraft({ ...draft, percent: e.target.value })} aria-label="Percent" className="w-20 px-3 py-2 rounded-lg border border-muted-300 text-right" />
            <span className="self-center">%</span>
          </div>
          <input value={draft.excluded} onChange={(e) => setDraft({ ...draft, excluded: e.target.value })} placeholder="Not on (categories, comma separated), e.g. alcohol" className="w-full px-3 py-2 rounded-lg border border-muted-300 text-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.stacks_with_reduced} onChange={(e) => setDraft({ ...draft, stacks_with_reduced: e.target.checked })} />
            Also applies to reduced / already-discounted items
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setDraft(null)} className="px-3 py-1.5 text-sm text-muted-600">Cancel</button>
            <button type="button" onClick={save} className="px-3 py-1.5 text-sm rounded-lg bg-primary-600 text-white">Save</button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminAISettings: React.FC = () => {
  const [data, setData] = useState<AdminAI | null>(null);
  const [limit, setLimit] = useState('');
  const [newModel, setNewModel] = useState<{ provider: 'anthropic' | 'openai'; model_id: string; label: string } | null>(null);

  useEffect(() => {
    expenseService.admin().then((d) => { setData(d); setLimit(String(d.receipt_scans_per_month)); }).catch(() => undefined);
  }, []);

  if (!data) return null;

  const saveModel = async (m: AIModelOption, patch: Partial<AIModelOption>) => {
    try {
      const next = { ...m, ...patch };
      setData(await expenseService.adminSaveModel({
        provider: next.provider, model_id: next.model_id, label: next.label, description: next.description,
        enabled: next.enabled ?? true, is_default: next.is_default, sort_order: next.sort_order ?? 0,
      }, m.id));
    } catch (error) {
      toast.error(parseApiError(error));
    }
  };

  return (
    <div className="card p-4 sm:p-6 space-y-4 border-2 border-warning-200">
      <div>
        <h2 className="text-lg font-semibold text-muted-900">App admin · receipt AI</h2>
        <p className="text-sm text-muted-500">
          Server keys: Claude {data.app_keys.anthropic ? '✓ set' : '✗ not set'} · OpenAI {data.app_keys.openai ? '✓ set' : '✗ not set'}.
          Keys are set in the server’s environment, never here.
        </p>
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setData(await expenseService.adminScanLimit(Number(limit)));
            toast.success('Limit saved');
          } catch (error) {
            toast.error(parseApiError(error));
          }
        }}
      >
        <label className="text-sm text-muted-700">Free scans per person per month</label>
        <input value={limit} inputMode="numeric" onChange={(e) => setLimit(e.target.value)} className="w-20 px-2 py-1.5 rounded-lg border border-muted-300 text-right" />
        <button type="submit" className="px-3 py-1.5 text-sm rounded-lg bg-primary-600 text-white">Save</button>
      </form>

      <div className="space-y-2">
        {data.models.map((m) => (
          <div key={m.id} className="flex items-center gap-3 py-1.5">
            <Switch checked={!!m.enabled} label={`${m.label} enabled`} onChange={(enabled) => saveModel(m, { enabled, is_default: enabled && m.is_default })} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.label}</p>
              <p className="text-xs text-muted-500 font-mono">{m.provider} · {m.model_id}</p>
            </div>
            {m.is_default ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">Default</span>
            ) : m.enabled && (
              <button type="button" onClick={() => saveModel(m, { is_default: true })} className="text-xs text-primary-700 hover:underline">Make default</button>
            )}
          </div>
        ))}
      </div>

      {newModel ? (
        <div className="flex flex-wrap gap-2">
          <select value={newModel.provider} onChange={(e) => setNewModel({ ...newModel, provider: e.target.value as 'anthropic' | 'openai' })} className="px-2 py-1.5 rounded-lg border border-muted-300 text-sm">
            <option value="anthropic">anthropic</option>
            <option value="openai">openai</option>
          </select>
          <input value={newModel.model_id} onChange={(e) => setNewModel({ ...newModel, model_id: e.target.value })} placeholder="model id" className="flex-1 min-w-[8rem] px-2 py-1.5 rounded-lg border border-muted-300 text-sm font-mono" />
          <input value={newModel.label} onChange={(e) => setNewModel({ ...newModel, label: e.target.value })} placeholder="Label people see" className="flex-1 min-w-[8rem] px-2 py-1.5 rounded-lg border border-muted-300 text-sm" />
          <button
            type="button"
            onClick={async () => {
              try {
                setData(await expenseService.adminSaveModel({ ...newModel, description: '', enabled: true, is_default: false, sort_order: data.models.length + 1 }));
                setNewModel(null);
              } catch (error) {
                toast.error(parseApiError(error));
              }
            }}
            className="px-3 py-1.5 text-sm rounded-lg bg-primary-600 text-white"
          >
            Add
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setNewModel({ provider: 'anthropic', model_id: '', label: '' })} className="text-sm text-primary-700 hover:underline">+ Add a model</button>
      )}
    </div>
  );
};

/** Expense settings for one chat (inside the chat info panel). */
export const ChatExpenseSettings: React.FC<{ conversationId: string; onOpenExpenses: () => void }> = ({ conversationId, onOpenExpenses }) => {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof expenseService.settings>> | null>(null);
  const [models, setModels] = useState<AIModelOption[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    expenseService.settings(conversationId).then(setSettings).catch(() => undefined);
    expenseService.aiSettings().then((s) => setModels(s.models)).catch(() => undefined);
    expenseService.currencies().then(setCurrencies).catch(() => undefined);
  }, [conversationId]);

  if (!settings) return null;
  const update = async (patch: Parameters<typeof expenseService.updateSettings>[1]) => {
    try {
      setSettings(await expenseService.updateSettings(conversationId, patch));
    } catch (error) {
      toast.error(parseApiError(error));
    }
  };
  const disabled = !settings.can_edit;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-700">Expenses</h3>
        <button type="button" onClick={onOpenExpenses} className="text-sm text-primary-700 hover:underline">Balances & expenses</button>
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Default currency</span>
        <select value={settings.default_currency} disabled={disabled} onChange={(e) => update({ default_currency: e.target.value })} className="px-2 py-1 rounded-lg border border-muted-300 bg-white disabled:opacity-60">
          {(currencies.length ? currencies : [{ code: settings.default_currency, name: '' }]).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </label>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>Simplify debts <span className="block text-xs text-muted-500">Fewest payments to settle up</span></span>
        <Switch checked={settings.simplify_debts} disabled={disabled} label="Simplify debts" onChange={(simplify_debts) => update({ simplify_debts })} />
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Receipt AI for this chat</span>
        <select value={settings.receipt_model_id ?? 0} disabled={disabled} onChange={(e) => update({ receipt_model_id: Number(e.target.value) })} className="max-w-[55%] px-2 py-1 rounded-lg border border-muted-300 bg-white disabled:opacity-60">
          <option value={0}>Each person’s choice</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
      {disabled && <p className="text-xs text-muted-500">Only group admins can change these.</p>}
    </div>
  );
};

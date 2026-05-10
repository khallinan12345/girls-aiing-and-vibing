// src/components/news/NewsManager.tsx
//
// Lightweight news poster — a single "Post News" button that opens a
// modal. No inline list. Leaders post to their org; platform admins pick
// any org or broadcast to all.

import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Newspaper, X, CheckCircle, Loader2, AlertCircle, ChevronDown, Building2,
} from 'lucide-react';
import classNames from 'classnames';

export interface OrgOption {
  id: string;
  name: string;
}

interface NewsManagerProps {
  isPlatformAdmin: boolean;
  userOrgId: string | null;
  userOrgName: string | null;
  allOrgs: OrgOption[];
}

const BLANK = {
  title: '',
  body: '',
  link: '',
  link_label: '',
  emoji: '',
  active: true,
  organization_id: null as string | null,
  organization_name: null as string | null,
};

const NewsManager: React.FC<NewsManagerProps> = ({
  isPlatformAdmin,
  userOrgId,
  userOrgName,
  allOrgs,
}) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const openModal = () => {
    setForm({
      ...BLANK,
      organization_id:   isPlatformAdmin ? null : userOrgId,
      organization_name: isPlatformAdmin ? null : userOrgName,
    });
    setSaveError(null);
    setSaved(false);
    setOpen(true);
  };

  const handleOrgChange = (orgId: string) => {
    if (orgId === '__all__') {
      setForm(f => ({ ...f, organization_id: null, organization_name: null }));
    } else {
      const org = allOrgs.find(o => o.id === orgId);
      setForm(f => ({
        ...f,
        organization_id:   orgId,
        organization_name: org?.name ?? null,
      }));
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setSaveError('Title and body are required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const { error } = await supabase.from('platform_news').insert({
        title:             form.title.trim(),
        body:              form.body.trim(),
        link:              form.link.trim() || null,
        link_label:        form.link_label.trim() || null,
        emoji:             form.emoji.trim() || null,
        active:            form.active,
        organization_id:   form.organization_id,
        organization_name: form.organization_name,
      });
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setOpen(false), 900);
    } catch (e: any) {
      setSaveError(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Trigger — rendered inline wherever the parent places it */}
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
      >
        <Newspaper size={14} />
        Post News
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Newspaper size={17} className="text-indigo-600" />
                Post News to Banner
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">

              {/* Org target — platform admins only */}
              {isPlatformAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Post to</label>
                  <div className="relative">
                    <select
                      value={form.organization_id ?? '__all__'}
                      onChange={e => handleOrgChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm pr-8 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="__all__">🌐 All Organizations (broadcast)</option>
                      {allOrgs.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Leader org indicator */}
              {!isPlatformAdmin && (
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
                  <Building2 size={13} className="text-purple-500 shrink-0" />
                  Posting to: <strong className="ml-1">{userOrgName ?? 'your organization'}</strong>
                </div>
              )}

              {/* Emoji + Title */}
              <div className="flex gap-2">
                <div className="w-20 shrink-0">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Emoji</label>
                  <input
                    type="text"
                    value={form.emoji}
                    onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                    placeholder="📢"
                    maxLength={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="What's the news?"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Details about this announcement…"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Optional link */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Link <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={form.link}
                    onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                    placeholder="https://…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Link label</label>
                  <input
                    type="text"
                    value={form.link_label}
                    onChange={e => setForm(f => ({ ...f, link_label: e.target.value }))}
                    placeholder="Learn more"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={classNames(
                    'relative w-10 h-5 rounded-full transition-colors cursor-pointer',
                    form.active ? 'bg-green-500' : 'bg-gray-300'
                  )}
                >
                  <span className={classNames(
                    'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    form.active ? 'translate-x-5' : 'translate-x-0'
                  )} />
                </div>
                <span className="text-sm text-gray-700">
                  {form.active ? 'Post immediately (active)' : 'Save as hidden'}
                </span>
              </label>
            </div>

            {saveError && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle size={14} /> {saveError}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={classNames(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors',
                  saved
                    ? 'bg-green-500'
                    : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60'
                )}
              >
                {saved
                  ? <><CheckCircle size={14} /> Posted!</>
                  : saving
                  ? <><Loader2 size={14} className="animate-spin" /> Posting…</>
                  : <><CheckCircle size={14} /> Post News</>
                }
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default NewsManager;

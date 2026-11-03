"use client";
import { useEffect, useState } from 'react';
import { readTabDraft, writeTabDraft } from './tab-drafts.js';
// Initial objects are module constants, keeping SSR output stable until storage is read.
export function useTabDraft(key, initial) {
    const [value, setValue] = useState(initial), [ready, setReady] = useState(false), [status, setStatus] = useState({ notice: '正在恢复标签页草稿…', saved: true });
    useEffect(() => { let active = true; Promise.resolve().then(() => { const state = readTabDraft(key, initial); if (active) {
        setValue(state.value);
        setStatus({ notice: state.notice, saved: state.saved });
        setReady(true);
    } }); return () => { active = false; }; }, [key, initial]);
    useEffect(() => { if (ready) {
        const state = writeTabDraft(key, value);
        Promise.resolve().then(() => setStatus({ notice: state.notice, saved: state.saved }));
    } }, [key, value, ready]);
    useEffect(() => { if (!ready || status.saved || !Object.values(value).some(v => typeof v === 'string' && v.length))
        return; const warn = (e) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [ready, status.saved, value]);
    return [value, setValue, { ...status, ready }];
}

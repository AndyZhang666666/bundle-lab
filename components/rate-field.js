"use client";
import { useEffect, useId, useState } from 'react';
import { NumberField, Group, Button, Slider, SliderTrack, SliderThumb } from 'react-aria-components';

// The raw number editor intentionally remains controlled by the existing validator.
// NumberField supplies accessible step buttons without committing/clamping on blur;
// Slider shares the same validated value. Empty/invalid text never replaces a draft.
export default function RateField({ label, value, onChange, onInvalid, basis }) {
  const id = useId();
  const [draft, setDraft] = useState(String(Math.round(value * 10000) / 100));
  const invalid = draft.trim() === '' || !Number.isFinite(Number(draft)) || Number(draft) < 0 || Number(draft) > 100;
  useEffect(() => setDraft(String(Math.round(value * 10000) / 100)), [value]);
  const edit = raw => {
    setDraft(raw);
    const valid = raw.trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0 && Number(raw) <= 100;
    onInvalid(label, !valid);
    if (valid) onChange(Number(raw) / 100);
  };
  const adjust = next => {
    if (!Number.isFinite(next)) return;
    const raw = String(Math.round(next * 1000000) / 1000000);
    edit(raw);
  };
  return <div className="field-stack rate-field" data-invalid={invalid || undefined}>
    <label className="rate-label" htmlFor={id}>{label}{basis && <small className="assumption-tag">{basis}</small>}</label>
    <NumberField aria-label={label + '精确调整'} value={value * 100} onChange={adjust} minValue={0} maxValue={100} step={0.1} isInvalid={invalid} validationBehavior="aria" className="rate-number">
      <Group className="rate-value">
        <Button slot="decrement" className="rate-step" aria-label={`${label}减少0.1个百分点`} isDisabled={invalid}>−</Button>
        <input id={id} aria-label={label + '数值'} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined} type="number" min="0" max="100" step="0.1" value={draft} onChange={e => edit(e.target.value)} />
        <span aria-hidden="true">%</span>
        <Button slot="increment" className="rate-step" aria-label={`${label}增加0.1个百分点`} isDisabled={invalid}>＋</Button>
      </Group>
    </NumberField>
    <Slider aria-label={label} className="rate-slider" minValue={0} maxValue={1} step={0.01} value={value} formatOptions={{style:'percent', maximumFractionDigits:1}} onChange={next => { onInvalid(label, false); onChange(next); setDraft(String(Math.round(next * 10000) / 100)); }}>
      <SliderTrack className="rate-track">{({state}) => <><div className="rate-track-fill" style={{width:`${state.getThumbPercent(0) * 100}%`}}/><SliderThumb className="rate-thumb"/></>}</SliderTrack>
    </Slider>
    {invalid && <small className="rate-error" id={`${id}-error`}>请输入0–100之间的数值。上一份有效输入仍保留。</small>}
  </div>;
}

import type * as React from 'react';
import { useEffect } from 'react';
import { Search } from 'lucide-react';
import { Field, Select } from './ui/Fields';
import { Button } from './ui/Button';
import { cn } from '../lib/cn';
import { GLOBALLABELS } from '../lib/global';
import { setSelectedMcc, useCentreOptions, useMccOptions, useSelectedMcc } from '../hooks/useCentres';

export const PlantMccField: React.FC<{ className?: string }> = ({ className }) => {
  const options = useMccOptions();
  const value = useSelectedMcc();
  return (
    <Field label={GLOBALLABELS.plantMcc} className={className}>
      <Select value={value} onChange={(e) => setSelectedMcc(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </Select>
    </Field>
  );
};

export const CentreField: React.FC<{
  value: string;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
  allValue?: string;
}> = ({ value, onChange, label = GLOBALLABELS.vlcName, className, allValue }) => {
  const options = useCentreOptions();
  const known = options.some((o) => o.id === value) || (allValue !== undefined && value === allValue);

  useEffect(() => {
    if (!known && options.length) onChange(allValue ?? options[0].id);
  }, [known, options, allValue, onChange]);

  return (
    <Field label={label} className={className}>
      <Select value={known ? value : allValue ?? options[0]?.id ?? ''} onChange={(e) => onChange(e.target.value)}>
        {allValue !== undefined && <option value={allValue}>{GLOBALLABELS.allCentres}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </Select>
    </Field>
  );
};

export const SubmitButton: React.FC<{
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
}> = ({ onClick, loading, disabled, className, label = 'Submit' }) => (
  <div className={cn('flex items-end', className)}>
    <Button className="w-full" icon={<Search size={16} />} loading={loading} disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  </div>
);

import type * as React from 'react';
import type { InputHTMLAttributes } from 'react';
import { Input } from './Fields';
import { MAX_PAST_MONTHS, earliestPastDate } from '../../lib/dateRange';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  /** How far back a date can be picked, counted from today. Default 3 months. */
  pastMonths?: number;
};


export const PastDateInput: React.FC<Props> = ({ pastMonths = MAX_PAST_MONTHS, min, max, onChange, onBlur, ...rest }) => {
  const floor = earliestPastDate(pastMonths);
  const lowest = typeof min === 'string' && min > floor ? min : floor;
  const highest = typeof max === 'string' && max ? max : undefined;
  return (
    <Input
      {...rest}
      type="date"
      min={lowest}
      max={highest}
      onChange={onChange}
      onBlur={(e) => {
        const el = e.currentTarget;
        const v = el.value;
        if (v && (v < floor || (highest && v > highest))) {
          el.value = v < floor ? floor : highest!;
          // the page's own handler reads e.target.value, so it gets the corrected date
          onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);
        }
        onBlur?.(e);
      }}
    />
  );
};

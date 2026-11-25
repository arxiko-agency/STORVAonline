import React, { createContext, useState } from 'react';
export const REGEXP_ONLY_DIGITS = '^\\d*$';
export const OTPInputContext = createContext({ slots: [] });
export const OTPInput = React.forwardRef(function OTPInput(props, ref) {
  const { maxLength, value, onChange, onComplete, pattern, containerClassName, className, disabled, id, inputMode, autoComplete, autoFocus } = props;
  const [focused, setFocused] = useState(false);
  const re = pattern ? new RegExp(pattern) : null;
  const slots = Array.from({ length: maxLength }, (_, i) => ({
    char: value[i] ?? null,
    isActive: focused && i === Math.min(value.length, maxLength - 1),
    hasFakeCaret: focused && i === value.length && value.length < maxLength,
  }));
  return React.createElement('div', { className: containerClassName },
    React.createElement(OTPInputContext.Provider, { value: { slots } }, props.children),
    React.createElement('input', {
      ref, id, className, disabled, inputMode, autoComplete, autoFocus, maxLength, value,
      'data-testid': 'otp-input',
      onFocus: () => setFocused(true), onBlur: () => setFocused(false),
      onChange: (e) => {
        const v = e.target.value;
        if (re && !re.test(v)) return;
        onChange && onChange(v);
        if (v.length === maxLength) onComplete && onComplete(v);
      },
    }));
});

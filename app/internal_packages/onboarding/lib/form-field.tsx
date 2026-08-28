import React from 'react';
import { localized } from 'mailspring-exports';

const FormField = (props: {
  field: string;
  title: string;
  type?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  autoComplete?: string;
  revealable?: boolean;
  submitting?: boolean;
  onFieldKeyPress?: (e: React.KeyboardEvent) => void;
  onFieldChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errorFieldNames?: string[];
  account: Record<string, any>;
}) => {
  const [revealed, setRevealed] = React.useState(false);
  const field = props.field;
  let val = props.account[field];
  if (props.field.includes('.')) {
    const [parent, key] = props.field.split('.');
    val = props.account[parent][key];
  }
  const hasError = Boolean(val && props.errorFieldNames.includes(props.field));
  const inputType = props.revealable && revealed ? 'text' : props.type || 'text';

  return (
    <span className={`form-field ${hasError ? 'form-field-error' : ''}`}>
      <label htmlFor={props.field}>{props.title}</label>
      <span className="form-field-control">
        <input
          type={inputType}
          id={props.field}
          style={props.style}
          className={hasError ? 'error' : ''}
          disabled={props.submitting}
          spellCheck={false}
          value={val || ''}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          aria-invalid={hasError}
          onKeyPress={props.onFieldKeyPress}
          onChange={props.onFieldChange}
        />
        {props.revealable && (
          <button
            type="button"
            className="form-field-reveal"
            aria-label={revealed ? localized('隐藏密码') : localized('显示密码')}
            aria-pressed={revealed}
            onClick={() => setRevealed(!revealed)}
          >
            {revealed ? localized('隐藏') : localized('显示')}
          </button>
        )}
      </span>
    </span>
  );
};

export default FormField;

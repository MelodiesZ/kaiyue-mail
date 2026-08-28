import React from 'react';
import { localized } from 'mailspring-exports';

interface YYMMDD {
  year: number;
  month: number;
  day: number;
}
interface YYMMDDInputProps {
  value: YYMMDD;
  onChange: (date: YYMMDD) => void;
}

export class YYMMDDInput extends React.Component<YYMMDDInputProps> {
  _year = React.createRef<HTMLInputElement>();
  _month = React.createRef<HTMLInputElement>();
  _day = React.createRef<HTMLInputElement>();

  _onBlur = () => {
    const year = Number(this._year.current.value);
    const month = Number(this._month.current.value);
    const day = Number(this._day.current.value);
    this.props.onChange({ year, month, day });
  };

  render() {
    const { year, month, day } = this.props.value;

    return (
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>{localized('Birthday')}</legend>
        <div className="yymmdd-inputs" style={{ display: 'flex' }}>
          <div className="contact-edit-field">
            <input
              ref={this._year}
              type="number"
              aria-label={localized('Year')}
              defaultValue={year ? `${year}` : ''}
              style={{ width: 60, marginRight: 5 }}
              placeholder={localized('YYYY')}
              onBlur={this._onBlur}
            />
          </div>
          <span aria-hidden="true" style={{ alignSelf: 'center', marginRight: 5 }}>
            /
          </span>
          <div className="contact-edit-field">
            <input
              max={12}
              min={1}
              ref={this._month}
              style={{ width: 50, marginRight: 5 }}
              aria-label={localized('Month')}
              placeholder={localized('MM')}
              type="number"
              defaultValue={month ? `${month}` : ''}
              onBlur={this._onBlur}
            />
          </div>
          <span aria-hidden="true" style={{ alignSelf: 'center', marginRight: 5 }}>
            /
          </span>
          <div className="contact-edit-field">
            <input
              max={31}
              min={1}
              ref={this._day}
              aria-label={localized('Day')}
              placeholder={localized('DD')}
              type="number"
              style={{ width: 46 }}
              defaultValue={day ? `${day}` : ''}
              onBlur={this._onBlur}
            />
          </div>
          <div style={{ flex: 1 }} />
        </div>
      </fieldset>
    );
  }
}

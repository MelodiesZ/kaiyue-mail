import React from 'react';
import { Actions, localized } from 'mailspring-exports';

export function CalendarEmptyState() {
  const onOpenAccountPreferences = () => {
    Actions.switchPreferencesTab('Accounts');
    Actions.openPreferences();
  };

  return (
    <div className="calendar-empty-state">
      <div className="calendar-empty-state-content">
        <div className="calendar-empty-state-icon" aria-hidden="true">
          日
        </div>
        <h2 className="calendar-empty-state-title">还没有可用日历</h2>
        <p className="calendar-empty-state-message">
          当前连接的账号未提供日历。您可添加 Google 账号，或任何支持 CalDAV 的账号。
        </p>
        <button
          type="button"
          className="btn btn-large btn-emphasis"
          onClick={onOpenAccountPreferences}
        >
          添加日历账号
        </button>
      </div>
    </div>
  );
}

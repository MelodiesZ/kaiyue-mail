import React from 'react';
import { isEqual } from 'underscore';
import { localized } from 'mailspring-exports';

interface ListEditorProps<T> {
  items: T[];
  itemTemplate: T;
  onChange: (items: T[]) => void;
  children: (item: T, onChange: (item: Partial<T>) => void) => React.ReactNode;
}

export class ListEditor<T> extends React.Component<ListEditorProps<T>> {
  render() {
    const { items, itemTemplate, children, onChange } = this.props;

    const displayed = items.length ? items : [itemTemplate];

    return (
      <div>
        {displayed.map((item, idx) => (
          <div className="list-editor-item" key={idx}>
            {children(item, (changes) => {
              onChange([...items.slice(0, idx), { ...item, ...changes }, ...items.slice(idx + 1)]);
            })}
            {isEqual(item, itemTemplate) ? (
              <>
                <div className="add-spacer" />
                <div className="add-spacer" />
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn remove"
                  aria-label={localized('Remove')}
                  onClick={() => {
                    onChange([...items.slice(0, idx), ...items.slice(idx + 1)]);
                  }}
                >
                  <span aria-hidden="true">−</span>
                </button>
                {idx === items.length - 1 ? (
                  <button
                    type="button"
                    className="btn add"
                    aria-label={localized('Add')}
                    onClick={() => {
                      onChange([...items, { ...itemTemplate }]);
                    }}
                  >
                    <span aria-hidden="true">+</span>
                  </button>
                ) : (
                  <div className="add-spacer" />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    );
  }
}

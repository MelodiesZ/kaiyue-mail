import React from 'react';
import { Contact, localized } from 'mailspring-exports';
import { ContactBase } from './ContactInfoMapping';
import { YYMMDDInput } from './YYMMDDInput';
import { ListEditor } from './ListEditor';
import { TypeaheadFreeInput } from './TypeaheadFreeInput';
import * as Icons from './SVGIcons';
import { ContactProfilePhoto } from 'mailspring-component-kit';

const contactLabels: Record<string, string> = {
  Home: '家庭',
  Work: '工作',
  Other: '其他',
  Mobile: '手机',
  Main: '主要',
  'Home Fax': '家庭传真',
  'Work Fax': '工作传真',
  'Google Voice': 'Google Voice',
  Pager: '呼机',
  Profile: '个人主页',
  Blog: '博客',
  'Home Page': '主页',
  Spouse: '配偶',
  Child: '子女',
  Mother: '母亲',
  Father: '父亲',
  Parent: '父母',
  Brother: '兄弟',
  Sister: '姐妹',
  Friend: '朋友',
  Relative: '亲属',
  Manager: '主管',
  Assistant: '助理',
  Reference: '推荐人',
  Partner: '合作伙伴',
  'Domestic Partner': '伴侣',
};

export const contactLabel = (value: string) => {
  const exact = contactLabels[value];
  if (exact) return exact;
  const matchedKey = Object.keys(contactLabels).find(
    (key) => key.toLocaleLowerCase() === value.toLocaleLowerCase()
  );
  return matchedKey ? contactLabels[matchedKey] : value;
};

const BaseTypes = ['Home', 'Work', 'Other'].map(contactLabel);

const PhoneTypes = [
  'Home',
  'Work',
  'Other',
  'Mobile',
  'Main',
  'Home Fax',
  'Work Fax',
  'Google Voice',
  'Pager',
].map(contactLabel);

const WebTypes = ['Profile', 'Blog', 'Home Page', 'Work'].map(contactLabel);

const RelationTypes = [
  'Spouse',
  'Child',
  'Mother',
  'Father',
  'Parent',
  'Brother',
  'Sister',
  'Friend',
  'Relative',
  'Manager',
  'Assistant',
  'Reference',
  'Partner',
  'Domestic Partner',
].map(contactLabel);

export class ContactDetailEdit extends React.Component<{
  data: ContactBase;
  contact: Contact;
  onChange: (changes: Partial<ContactBase>) => void;
}> {
  render() {
    const { onChange, contact, data } = this.props;

    return (
      <div className="contact-detail-content-wrap">
        <div className="contact-edit-section">
          <div className="contact-edit-section-icon" style={{ padding: 0, marginTop: 0 }}>
            <ContactProfilePhoto contact={contact} loading={false} avatar={data.photoURL} />
          </div>
          <div className="contact-edit-section-content">
            <div className="contact-edit-field">
              <label>
                名
                <input
                  type="text"
                  value={data.name.givenName}
                  onChange={(e) =>
                    onChange({ name: { ...data.name, givenName: e.currentTarget.value } })
                  }
                />
              </label>
            </div>
            <div className="contact-edit-field">
              <label>
                姓
                <input
                  type="text"
                  value={data.name.familyName}
                  onChange={(e) =>
                    onChange({ name: { ...data.name, familyName: e.currentTarget.value } })
                  }
                />
              </label>
            </div>

            <ListEditor<ContactBase['nicknames'][0]>
              items={data.nicknames || []}
              itemTemplate={{ value: '' }}
              onChange={(items) => onChange({ nicknames: items })}
            >
              {(item, onChange) => (
                <div className="contact-edit-field">
                  <label>
                    昵称
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => onChange({ value: e.currentTarget.value })}
                    />
                  </label>
                </div>
              )}
            </ListEditor>
          </div>
        </div>

        <div className="contact-edit-section">
          <div className="contact-edit-section-icon">
            <Icons.Briefcase />
          </div>
          <div className="contact-edit-section-content">
            <div className="contact-edit-twoup">
              <div className="contact-edit-field">
                <label>
                  职务
                  <input
                    type="text"
                    value={data.title}
                    onChange={(e) => onChange({ title: e.currentTarget.value })}
                  />
                </label>
              </div>
              <div className="contact-edit-field" style={{ flex: 0.7 }}>
                <label>
                  公司
                  <input
                    type="text"
                    value={data.company}
                    onChange={(e) => onChange({ company: e.currentTarget.value })}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="contact-edit-section">
          <div className="contact-edit-section-icon">
            <Icons.Envelope />
          </div>
          <div className="contact-edit-section-content">
            <ListEditor<ContactBase['emailAddresses'][0]>
              items={data.emailAddresses || []}
              itemTemplate={{ type: '', value: '' }}
              onChange={(items) => onChange({ emailAddresses: items })}
            >
              {(item, onChange) => (
                <div className="contact-edit-twoup">
                  <div className="contact-edit-field">
                    <label>
                      邮箱
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => onChange({ value: e.currentTarget.value })}
                      />
                    </label>
                  </div>
                  <div className="contact-edit-field" style={{ flex: 0.7 }}>
                    <span aria-hidden="true" className="form-spacer" />
                    <TypeaheadFreeInput
                      aria-label="邮箱类型"
                      placeholder="标签"
                      suggestions={BaseTypes}
                      value={contactLabel(item.type || '')}
                      onChange={(e) => onChange({ type: e.currentTarget.value })}
                    />
                  </div>
                </div>
              )}
            </ListEditor>
          </div>
        </div>

        <div className="contact-edit-section">
          <div className="contact-edit-section-icon">
            <Icons.Phone />
          </div>
          <div className="contact-edit-section-content">
            <ListEditor<ContactBase['phoneNumbers'][0]>
              items={data.phoneNumbers || []}
              itemTemplate={{ type: '', value: '' }}
              onChange={(items) => onChange({ phoneNumbers: items })}
            >
              {(item, onChange) => (
                <div className="contact-edit-twoup">
                  <div className="contact-edit-field">
                    <label>
                      电话
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => onChange({ value: e.currentTarget.value })}
                      />
                    </label>
                  </div>
                  <div className="contact-edit-field" style={{ flex: 0.7 }}>
                    <span aria-hidden="true" className="form-spacer" />
                    <TypeaheadFreeInput
                      aria-label="电话类型"
                      placeholder="标签"
                      suggestions={PhoneTypes}
                      value={contactLabel(item.type || '')}
                      onChange={(e) => onChange({ type: e.currentTarget.value })}
                    />
                  </div>
                </div>
              )}
            </ListEditor>
          </div>
        </div>
        <div className="contact-edit-section">
          <div className="contact-edit-section-icon">
            <Icons.Map />
          </div>
          <div className="contact-edit-section-content">
            <ListEditor<ContactBase['addresses'][0]>
              items={data.addresses || []}
              itemTemplate={{
                type: '',
                formattedValue: '',
                city: '',
                country: '',
                postalCode: '',
                region: '',
                streetAddress: '',
                extendedAddress: '',
              }}
              onChange={(items) => onChange({ addresses: items })}
            >
              {(item, onChange) => (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div className="contact-edit-field">
                    <label>
                      街道地址
                      <input
                        type="text"
                        value={item.streetAddress}
                        onChange={(e) => onChange({ streetAddress: e.currentTarget.value })}
                      />
                    </label>
                  </div>
                  <div className="contact-edit-field">
                    <label>
                      详细地址
                      <input
                        type="text"
                        value={item.extendedAddress}
                        onChange={(e) => onChange({ extendedAddress: e.currentTarget.value })}
                      />
                    </label>
                  </div>
                  <div className="contact-edit-field">
                    <label>
                      城市
                      <input
                        type="text"
                        value={item.city}
                        onChange={(e) => onChange({ city: e.currentTarget.value })}
                      />
                    </label>
                  </div>
                  <div className="contact-edit-twoup">
                    <div className="contact-edit-field">
                      <label>
                        省 / 地区
                        <input
                          type="text"
                          value={item.region}
                          onChange={(e) => onChange({ region: e.currentTarget.value })}
                        />
                      </label>
                    </div>
                    <div className="contact-edit-field" style={{ flex: 0.7 }}>
                      <label>
                        邮政编码
                        <input
                          type="text"
                          value={item.postalCode}
                          onChange={(e) => onChange({ postalCode: e.currentTarget.value })}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="contact-edit-field">
                    <label>
                      国家 / 地区
                      <input
                        type="text"
                        value={item.country}
                        onChange={(e) => onChange({ country: e.currentTarget.value })}
                      />
                    </label>
                  </div>
                  <div className="contact-edit-field" style={{ flex: 0.7 }}>
                    <span aria-hidden="true" className="form-spacer" />
                    <TypeaheadFreeInput
                      aria-label="地址类型"
                      placeholder="标签"
                      suggestions={BaseTypes}
                      value={contactLabel(item.type || '')}
                      onChange={(e) => onChange({ type: e.currentTarget.value })}
                    />
                  </div>
                </div>
              )}
            </ListEditor>
          </div>
        </div>
        <div className="contact-edit-section">
          <div className="contact-edit-section-icon">
            <Icons.Crown />
          </div>
          <div className="contact-edit-section-content">
            <ListEditor<ContactBase['birthdays'][0]>
              items={data.birthdays || []}
              itemTemplate={{ date: { year: null, month: null, day: null } }}
              onChange={(items) => onChange({ birthdays: items })}
            >
              {(item, onChange) => (
                <YYMMDDInput value={item.date} onChange={(date) => onChange({ date })} />
              )}
            </ListEditor>
          </div>
        </div>
        {data.relations !== undefined && (
          <div className="contact-edit-section">
            <div className="contact-edit-section-icon">
              <Icons.People />
            </div>
            <div className="contact-edit-section-content">
              <ListEditor<ContactBase['relations'][0]>
                items={data.relations || []}
                itemTemplate={{ person: '', type: '' }}
                onChange={(items) => onChange({ relations: items })}
              >
                {(item, onChange) => (
                  <div className="contact-edit-twoup">
                    <div className="contact-edit-field">
                      <label>
                        关系人
                        <input
                          type="text"
                          value={item.person}
                          onChange={(e) => onChange({ person: e.currentTarget.value })}
                        />
                      </label>
                    </div>
                    <div className="contact-edit-field" style={{ flex: 0.7 }}>
                      <span aria-hidden="true" className="form-spacer" />
                      <TypeaheadFreeInput
                        aria-label="关系类型"
                        placeholder="关系"
                        suggestions={RelationTypes}
                        value={contactLabel(item.type || '')}
                        onChange={(e) => onChange({ type: e.currentTarget.value })}
                      />
                    </div>
                  </div>
                )}
              </ListEditor>
            </div>
          </div>
        )}
        <div className="contact-edit-section">
          <div className="contact-edit-section-icon">
            <Icons.Link />
          </div>
          <div className="contact-edit-section-content">
            <ListEditor<ContactBase['urls'][0]>
              items={data.urls || []}
              itemTemplate={{ value: '', type: '' }}
              onChange={(items) => onChange({ urls: items })}
            >
              {(item, onChange) => (
                <div className="contact-edit-twoup">
                  <div className="contact-edit-field">
                    <label>
                      链接
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => onChange({ value: e.currentTarget.value })}
                      />
                    </label>
                  </div>
                  <div className="contact-edit-field" style={{ flex: 0.7 }}>
                    <span aria-hidden="true" className="form-spacer" />
                    <TypeaheadFreeInput
                      aria-label="链接类型"
                      placeholder="标签"
                      suggestions={WebTypes}
                      value={contactLabel(item.type || '')}
                      onChange={(e) => onChange({ type: e.currentTarget.value })}
                    />
                  </div>
                </div>
              )}
            </ListEditor>
          </div>
        </div>
        <div className="contact-edit-section">
          <div className="contact-edit-section-icon">
            <Icons.Note />
          </div>
          <div className="contact-edit-section-content">
            <div className="contact-edit-field">
              <label>
                备注
                <textarea
                  className="contact-notes-textarea"
                  value={data.notes || ''}
                  onChange={(e) => onChange({ notes: e.currentTarget.value })}
                  rows={4}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

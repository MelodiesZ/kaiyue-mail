import React from 'react';
import { localized } from 'mailspring-exports';
import { RetinaImg } from './retina-img';

export default class FeatureUsedUpModal extends React.Component<{
  modalClass: string;
  iconUrl: string;
  rechargeText: string;
  headerText: string;
}> {
  render() {
    return (
      <div className={`feature-usage-modal ${this.props.modalClass}`}>
        <div className="feature-header">
          <div className="icon">
            <RetinaImg
              url={this.props.iconUrl}
              style={{ position: 'relative', top: '-2px' }}
              mode={RetinaImg.Mode.ContentPreserve}
            />
          </div>
          <h2 className="header-text">{this.props.headerText}</h2>
          <p className="recharge-text">{this.props.rechargeText}</p>
        </div>
        <div className="feature-cta">
          <div className="pro-description">
            <h3>{localized('功能暂不可用')}</h3>
            <p>{localized('请联系企业邮箱管理员。')}</p>
          </div>
        </div>
      </div>
    );
  }
}

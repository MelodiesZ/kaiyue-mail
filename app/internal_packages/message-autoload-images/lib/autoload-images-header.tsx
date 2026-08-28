import React from 'react';
import { localized, Message } from 'mailspring-exports';

import AutoloadImagesStore from './autoload-images-store';
import * as Actions from './autoload-images-actions';

export default class AutoloadImagesHeader extends React.Component<
  { message: Message },
  { blocking: boolean }
> {
  static displayName = 'AutoloadImagesHeader';

  _unlisten?: () => void;

  constructor(props) {
    super(props);
    this.state = {
      blocking: AutoloadImagesStore.shouldBlockImagesIn(this.props.message),
    };
  }

  componentDidMount() {
    this._unlisten = AutoloadImagesStore.listen(() => {
      const blocking = AutoloadImagesStore.shouldBlockImagesIn(this.props.message);
      if (blocking !== this.state.blocking) {
        this.setState({ blocking });
      }
    });
  }

  componentDidUpdate(prevProps: { message: Message }) {
    if (prevProps.message !== this.props.message) {
      const blocking = AutoloadImagesStore.shouldBlockImagesIn(this.props.message);
      if (blocking !== this.state.blocking) {
        this.setState({ blocking });
      }
    }
  }

  componentWillUnmount() {
    this._unlisten();
  }

  render() {
    const { message } = this.props;
    const { blocking } = this.state;

    if (blocking === false) {
      return <div />;
    }

    return (
      <div className="autoload-images-header" role="status">
        <span className="autoload-images-message">远程图片已拦截，以保护您的隐私</span>
        <button
          type="button"
          className="option"
          onClick={() => Actions.temporarilyEnableImages(message)}
        >
          显示图片
        </button>
        <button
          type="button"
          className="option"
          aria-label={`始终显示 ${message.fromContact().toString()} 发送的图片`}
          onClick={() => Actions.permanentlyEnableImages(message)}
        >
          始终显示此发件人的图片
        </button>
      </div>
    );
  }
}

import { LibsessionUtilUserWasm } from '../../../../libsession/user/userWrappers';
import { SignalService } from '../../../../protobuf';
import { VisibleMessage, VisibleMessageParams } from './VisibleMessage';

// eslint-disable-next-line @typescript-eslint/ban-types
export type OpenGroupVisibleMessageParams = Omit<
  VisibleMessageParams,
  'expirationType' | 'expireTimer'
>;

export class OpenGroupVisibleMessage extends VisibleMessage {
  private readonly blocksCommunityMessageRequests: boolean;

  constructor(params: OpenGroupVisibleMessageParams) {
    super({
      ...params,
      expirationType: 'unknown',
      expireTimer: 0,
    });
    // they are the opposite of each others
    this.blocksCommunityMessageRequests =
      !LibsessionUtilUserWasm.getUserProfile().getBlindedMsgRequests();
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = super.dataProto();

    dataMessage.blocksCommunityMessageRequests = this.blocksCommunityMessageRequests;

    return dataMessage;
  }
}

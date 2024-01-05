import { useSelector } from 'react-redux';
import { UserUtils } from '../../session/utils';
import {
  LastMessageStatusType,
  MessageModelPropsWithConvoProps,
  PropsForAttachment,
  ReduxConversationType,
} from '../ducks/conversations';
import { StateType } from '../reducer';
import { getMessagePropsByMessageId } from './conversations';
import { useSelectedIsPrivate } from './selectedConversation';

function useMessagePropsByMessageId(messageId: string | undefined) {
  return useSelector((state: StateType) => getMessagePropsByMessageId(state, messageId));
}

const useSenderConvoProps = (
  msgProps: MessageModelPropsWithConvoProps | undefined
): ReduxConversationType | undefined => {
  return useSelector((state: StateType) => {
    const sender = msgProps?.propsForMessage.sender;
    if (!sender) {
      return undefined;
    }
    return state.conversations.conversationLookup[sender] || undefined;
  });
};

export const useAuthorProfileName = (messageId: string): string | null => {
  const msg = useMessagePropsByMessageId(messageId);
  const senderProps = useSenderConvoProps(msg);
  if (!msg || !senderProps) {
    return null;
  }

  const senderIsUs = msg.propsForMessage.sender === UserUtils.getOurPubKeyStrFromCache();

  const authorProfileName = senderIsUs
    ? window.i18n('you')
    : senderProps.nickname || senderProps.displayNameInProfile || window.i18n('anonymous');
  return authorProfileName || window.i18n('unknown');
};

export const useAuthorName = (messageId: string): string | null => {
  const msg = useMessagePropsByMessageId(messageId);
  const senderProps = useSenderConvoProps(msg);
  if (!msg || !senderProps) {
    return null;
  }

  const authorName = senderProps.nickname || senderProps.displayNameInProfile || null;
  return authorName;
};

export const useAuthorAvatarPath = (messageId: string): string | null => {
  const msg = useMessagePropsByMessageId(messageId);
  const senderProps = useSenderConvoProps(msg);
  if (!msg || !senderProps) {
    return null;
  }

  return senderProps.avatarPath || null;
};

export const useMessageIsDeleted = (messageId: string): boolean => {
  const props = useMessagePropsByMessageId(messageId);
  return props?.propsForMessage.isDeleted || false;
};

export const useFirstMessageOfSeries = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.firstMessageOfSeries || false;
};

export const useLastMessageOfSeries = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.lastMessageOfSeries || false;
};

export const useMessageAuthor = (messageId: string | undefined): string | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.sender;
};

export const useMessageDirection = (messageId: string | undefined): string | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.direction;
};

export const useMessageLinkPreview = (messageId: string | undefined): Array<any> | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.previews;
};

export const useMessageAttachments = (
  messageId: string | undefined
): Array<PropsForAttachment> | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.attachments;
};

export const useMessageSenderIsAdmin = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.isSenderAdmin || false;
};

export const useMessageIsDeletable = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.isDeletable || false;
};

export const useMessageStatus = (
  messageId: string | undefined
): LastMessageStatusType | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.status;
};

export function useMessageSender(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.sender;
}

export function useMessageIsDeletableForEveryone(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.isDeletableForEveryone;
}

export function useMessageServerTimestamp(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.serverTimestamp;
}

export function useMessageTimestamp(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.timestamp;
}

export function useMessageBody(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.text;
}

export function useHideAvatarInMsgList(messageId?: string) {
  const msgProps = useMessagePropsByMessageId(messageId);
  const selectedIsPrivate = useSelectedIsPrivate();
  return msgProps?.propsForMessage.direction === 'outgoing' || selectedIsPrivate;
}

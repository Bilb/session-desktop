import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { contextMenu } from 'react-contexify';
import { useDispatch, useSelector } from 'react-redux';
import styled, { keyframes } from 'styled-components';

import useInterval from 'react-use/lib/useInterval';
import useMount from 'react-use/lib/useMount';

import { isNil, isString, toNumber } from 'lodash';
import { Data } from '../../../../data/data';
import { MessageRenderingProps } from '../../../../models/messageType';
import { ConvoHub } from '../../../../session/conversations';
import { messagesExpired } from '../../../../state/ducks/conversations';
import {
  getGenericReadableMessageSelectorProps,
  getIsMessageSelected,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import { getIncrement } from '../../../../util/timer';
import { ExpireTimer } from '../../ExpireTimer';

import { isOpenOrClosedGroup } from '../../../../models/conversationAttributes';
import { MessageContentWithStatuses } from '../message-content/MessageContentWithStatus';
import { StyledMessageReactionsContainer } from '../message-content/MessageReactions';
import { ReadableMessage } from './ReadableMessage';

export type GenericReadableMessageSelectorProps = Pick<
  MessageRenderingProps,
  | 'direction'
  | 'conversationType'
  | 'receivedAt'
  | 'isUnread'
  | 'expirationLength'
  | 'expirationTimestamp'
  | 'isKickedFromGroup'
  | 'isExpired'
  | 'convoId'
  | 'isDeleted'
>;

type ExpiringProps = {
  isExpired?: boolean;
  expirationTimestamp?: number | null;
  expirationLength?: number | null;
  convoId?: string;
  messageId: string;
};
const EXPIRATION_CHECK_MINIMUM = 2000;

function useIsExpired(props: ExpiringProps) {
  const {
    convoId,
    messageId,
    expirationLength,
    expirationTimestamp,
    isExpired: isExpiredProps,
  } = props;

  const dispatch = useDispatch();

  const [isExpired] = useState(isExpiredProps);

  const checkExpired = useCallback(async () => {
    const now = Date.now();

    if (!expirationTimestamp || !expirationLength) {
      return;
    }

    if (isExpired || now >= expirationTimestamp) {
      await Data.removeMessage(messageId);
      if (convoId) {
        dispatch(
          messagesExpired([
            {
              conversationKey: convoId,
              messageId,
            },
          ])
        );
        const convo = ConvoHub.use().get(convoId);
        convo?.updateLastMessage();
      }
    }
  }, [dispatch, expirationTimestamp, expirationLength, isExpired, messageId, convoId]);

  let checkFrequency: number | null = null;
  if (expirationLength) {
    const increment = getIncrement(expirationLength || EXPIRATION_CHECK_MINIMUM);
    checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);
  }

  useMount(() => {
    void checkExpired();
  });
  useInterval(checkExpired, checkFrequency); // check every 2sec or sooner if needed

  return { isExpired };
}

type Props = {
  messageId: string;
  ctxMenuID: string;
  isDetailView?: boolean;
};

const highlightedMessageAnimation = keyframes`
  1% {
      background-color: var(--primary-color);
  }
`;

const StyledReadableMessage = styled(ReadableMessage)<{
  selected: boolean;
  isRightClicked: boolean;
}>`
  display: flex;
  align-items: center;
  width: 100%;
  letter-spacing: 0.03rem;
  padding: 0 var(--margins-lg) 0;

  &.message-highlighted {
    animation: ${highlightedMessageAnimation} 1s ease-in-out;
  }

  ${StyledMessageReactionsContainer} {
    margin-top: var(--margins-xs);
  }

  ${props =>
    props.isRightClicked &&
    `
    background-color: var(--conversation-tab-background-selected-color);
  `}

  ${props =>
    props.selected &&
    `
    &.message-selected {
      .module-message {
        &__container {
          box-shadow: var(--drop-shadow);
        }
      }
    }
    `}
`;

export const GenericReadableMessage = (props: Props) => {
  const { ctxMenuID, messageId, isDetailView } = props;

  const [enableReactions, setEnableReactions] = useState(true);

  const msgProps = useSelector(state =>
    getGenericReadableMessageSelectorProps(state as any, props.messageId)
  );

  const expiringProps: ExpiringProps = {
    convoId: msgProps?.convoId,
    expirationLength: msgProps?.expirationLength,
    messageId: props.messageId,
    expirationTimestamp: msgProps?.expirationTimestamp,
    isExpired: msgProps?.isExpired,
  };
  const { isExpired } = useIsExpired(expiringProps);

  const isMessageSelected = useSelector(state =>
    getIsMessageSelected(state as any, props.messageId)
  );
  const multiSelectMode = useSelector(isMessageSelectionMode);

  const [isRightClicked, setIsRightClicked] = useState(false);
  const onMessageLoseFocus = useCallback(() => {
    if (isRightClicked) {
      setIsRightClicked(false);
    }
  }, [isRightClicked]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // this is quite dirty but considering that we want the context menu of the message to show on click on the attachment
      // and the context menu save attachment item to save the right attachment I did not find a better way for now.

      // Note: If you change this, also make sure to update the `saveAttachment()` in MessageContextMenu.tsx
      const enableContextMenu = !multiSelectMode && !msgProps?.isKickedFromGroup;
      const attachmentIndexStr = (e?.target as any)?.parentElement?.getAttribute?.(
        'data-attachmentindex'
      );
      const attachmentIndex =
        isString(attachmentIndexStr) && !isNil(toNumber(attachmentIndexStr))
          ? toNumber(attachmentIndexStr)
          : 0;

      if (enableContextMenu) {
        contextMenu.hideAll();
        contextMenu.show({
          id: ctxMenuID,
          event: e,
          props: {
            dataAttachmentIndex: attachmentIndex,
          },
        });
      }
      setIsRightClicked(enableContextMenu);
    },
    [ctxMenuID, multiSelectMode, msgProps?.isKickedFromGroup]
  );

  useEffect(() => {
    if (msgProps?.convoId) {
      const conversationModel = ConvoHub.use().get(msgProps?.convoId);
      if (conversationModel) {
        setEnableReactions(conversationModel.hasReactions());
      }
    }
  }, [msgProps?.convoId]);

  useEffect(() => {
    document.addEventListener('click', onMessageLoseFocus);

    return () => {
      document.removeEventListener('click', onMessageLoseFocus);
    };
  }, [onMessageLoseFocus]);

  if (!msgProps) {
    return null;
  }
  const {
    direction,
    conversationType,
    receivedAt,
    isUnread,
    expirationLength,
    expirationTimestamp,
  } = msgProps;

  if (isExpired) {
    return null;
  }

  const selected = isMessageSelected || false;
  const isGroup = isOpenOrClosedGroup(conversationType);
  const isIncoming = direction === 'incoming';

  return (
    <StyledReadableMessage
      messageId={messageId}
      selected={selected}
      isRightClicked={isRightClicked}
      className={classNames(
        selected && 'message-selected',
        isGroup && 'public-chat-message-wrapper'
      )}
      onContextMenu={handleContextMenu}
      receivedAt={receivedAt}
      isUnread={!!isUnread}
      key={`readable-message-${messageId}`}
    >
      {expirationLength && expirationTimestamp && (
        <ExpireTimer
          isCorrectSide={!isIncoming}
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
        />
      )}
      <MessageContentWithStatuses
        ctxMenuID={ctxMenuID}
        messageId={messageId}
        isDetailView={isDetailView}
        dataTestId={`message-content-${messageId}`}
        enableReactions={enableReactions}
      />
      {expirationLength && expirationTimestamp && (
        <ExpireTimer
          isCorrectSide={isIncoming}
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
        />
      )}
    </StyledReadableMessage>
  );
};

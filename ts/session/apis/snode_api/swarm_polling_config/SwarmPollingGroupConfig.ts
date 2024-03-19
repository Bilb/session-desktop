import { GroupPubkeyType } from 'libsession_util_nodejs';
import { isFinite, isNumber } from 'lodash';
import { Data } from '../../../../data/data';
import { messagesExpired } from '../../../../state/ducks/conversations';
import { groupInfoActions } from '../../../../state/ducks/metaGroups';
import { MetaGroupWrapperActions } from '../../../../webworker/workers/browser/libsession_worker_interface';
import { ed25519Str } from '../../../onions/onionPath';
import { fromBase64ToArray } from '../../../utils/String';
import { LibSessionUtil } from '../../../utils/libsession/libsession_utils';
import { SnodeNamespaces } from '../namespaces';
import { RetrieveMessageItemWithNamespace } from '../types';

/**
 * This is a basic optimization to avoid running the logic when the `deleteBeforeSeconds`
 *  and the `deleteAttachBeforeSeconds` does not change between each polls.
 * Essentially, when the `deleteBeforeSeconds` is set in the group info config,
 *   - on start that map will be empty so we will run the logic to delete any messages sent before that.
 *   - after each poll, we will only rerun the logic if the new `deleteBeforeSeconds` is higher than the current setting.
 *
 */
const lastAppliedRemoveMsgSentBeforeSeconds = new Map<GroupPubkeyType, number>();
const lastAppliedRemoveAttachmentSentBeforeSeconds = new Map<GroupPubkeyType, number>();

async function handleMetaMergeResults(groupPk: GroupPubkeyType) {
  const infos = await MetaGroupWrapperActions.infoGet(groupPk);
  if (
    infos &&
    isNumber(infos.deleteBeforeSeconds) &&
    isFinite(infos.deleteBeforeSeconds) &&
    infos.deleteBeforeSeconds > 0 &&
    (lastAppliedRemoveMsgSentBeforeSeconds.get(groupPk) || Number.MAX_SAFE_INTEGER) >
      infos.deleteBeforeSeconds
  ) {
    // delete any messages in this conversation sent before that timestamp (in seconds)
    const deletedMsgIds = await Data.removeAllMessagesInConversationSentBefore({
      deleteBeforeSeconds: infos.deleteBeforeSeconds,
      conversationId: groupPk,
    });
    window.log.info(
      `removeAllMessagesInConversationSentBefore of ${ed25519Str(groupPk)} before ${infos.deleteBeforeSeconds}: `,
      deletedMsgIds
    );
    window.inboxStore.dispatch(
      messagesExpired(deletedMsgIds.map(messageId => ({ conversationKey: groupPk, messageId })))
    );
    lastAppliedRemoveMsgSentBeforeSeconds.set(groupPk, infos.deleteBeforeSeconds);
  }

  if (
    infos &&
    isNumber(infos.deleteAttachBeforeSeconds) &&
    isFinite(infos.deleteAttachBeforeSeconds) &&
    infos.deleteAttachBeforeSeconds > 0 &&
    (lastAppliedRemoveAttachmentSentBeforeSeconds.get(groupPk) || Number.MAX_SAFE_INTEGER) >
      infos.deleteAttachBeforeSeconds
  ) {
    // delete any attachments in this conversation sent before that timestamp (in seconds)
    const impactedMsgModels = await Data.getAllMessagesWithAttachmentsInConversationSentBefore({
      deleteAttachBeforeSeconds: infos.deleteAttachBeforeSeconds,
      conversationId: groupPk,
    });
    window.log.info(
      `getAllMessagesWithAttachmentsInConversationSentBefore of ${ed25519Str(groupPk)} before ${infos.deleteAttachBeforeSeconds}: impactedMsgModelsIds `,
      impactedMsgModels.map(m => m.id)
    );

    for (let index = 0; index < impactedMsgModels.length; index++) {
      const msg = impactedMsgModels[index];

      // eslint-disable-next-line no-await-in-loop
      // eslint-disable-next-line no-await-in-loop
      await msg?.cleanup();
    }
    lastAppliedRemoveAttachmentSentBeforeSeconds.set(groupPk, infos.deleteAttachBeforeSeconds);
  }
}

async function handleGroupSharedConfigMessages(
  groupConfigMessages: Array<RetrieveMessageItemWithNamespace>,
  groupPk: GroupPubkeyType
) {
  try {
    window.log.info(
      `received groupConfigMessages count: ${groupConfigMessages.length} for groupPk:${ed25519Str(
        groupPk
      )}`
    );

    if (groupConfigMessages.find(m => !m.storedAt)) {
      throw new Error('all incoming group config message should have a timestamp');
    }
    const infos = groupConfigMessages
      .filter(m => m.namespace === SnodeNamespaces.ClosedGroupInfo)
      .map(info => {
        return { data: fromBase64ToArray(info.data), hash: info.hash };
      });
    const members = groupConfigMessages
      .filter(m => m.namespace === SnodeNamespaces.ClosedGroupMembers)
      .map(info => {
        return { data: fromBase64ToArray(info.data), hash: info.hash };
      });
    const keys = groupConfigMessages
      .filter(m => m.namespace === SnodeNamespaces.ClosedGroupKeys)
      .map(info => {
        return {
          data: fromBase64ToArray(info.data),
          hash: info.hash,
          timestampMs: info.storedAt,
        };
      });
    const toMerge = {
      groupInfo: infos,
      groupKeys: keys,
      groupMember: members,
    };

    window.log.info(
      `received keys: ${toMerge.groupKeys.length},infos: ${toMerge.groupInfo.length},members: ${
        toMerge.groupMember.length
      } for groupPk:${ed25519Str(groupPk)}`
    );
    // do the merge with our current state
    await MetaGroupWrapperActions.metaMerge(groupPk, toMerge);

    await handleMetaMergeResults(groupPk);

    // save updated dumps to the DB right away
    await LibSessionUtil.saveDumpsToDb(groupPk);

    // refresh the redux slice with the merged result
    window.inboxStore.dispatch(
      groupInfoActions.refreshGroupDetailsFromWrapper({
        groupPk,
      })
    );
  } catch (e) {
    window.log.warn(
      `handleGroupSharedConfigMessages of ${groupConfigMessages.length} failed with ${e.message}`
    );
    // not rethrowing
  }
}

export const SwarmPollingGroupConfig = { handleGroupSharedConfigMessages };

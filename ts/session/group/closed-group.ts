import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { getMessageQueue } from '..';
import { Data } from '../../data/data';
import { ConversationModel } from '../../models/conversation';
import { ConversationAttributes, ConversationTypeEnum } from '../../models/conversationAttributes';
import { MessageModel } from '../../models/message';
import { MessageAttributesOptionals, MessageGroupUpdate } from '../../models/messageType';
import { SignalService } from '../../protobuf';
import {
  addKeyPairToCacheAndDBIfNeeded,
  distributingClosedGroupEncryptionKeyPairs,
} from '../../receiver/closedGroups';
import { ECKeyPair } from '../../receiver/keypairs';
import { PropsForGroupUpdateType } from '../../state/ducks/conversations';
import { GetNetworkTime } from '../apis/snode_api/getNetworkTime';
import { SnodeNamespaces } from '../apis/snode_api/namespaces';
import { ConvoHub } from '../conversations';
import { generateCurve25519KeyPairWithoutPrefix } from '../crypto';
import { encryptUsingSessionProtocol } from '../crypto/MessageEncrypter';
import { DisappearingMessages } from '../disappearing_messages';
import { DisappearAfterSendOnly, DisappearingMessageUpdate } from '../disappearing_messages/types';
import { ClosedGroupAddedMembersMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupAddedMembersMessage';
import { ClosedGroupEncryptionPairMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupEncryptionPairMessage';
import { ClosedGroupNameChangeMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupNameChangeMessage';
import { ClosedGroupNewMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupNewMessage';
import { ClosedGroupRemovedMembersMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupRemovedMembersMessage';
import { PubKey } from '../types';
import { UserUtils } from '../utils';
import { fromHexToArray, toHex } from '../utils/String';
import { PreConditionFailed } from '../utils/errors';

export type GroupInfo = {
  id: string;
  name: string;
  members: Array<string>;
  zombies?: Array<string>;
  activeAt?: number;
  expirationType?: DisappearAfterSendOnly;
  expireTimer?: number;
  admins?: Array<string>;
};

export type GroupDiff = PropsForGroupUpdateType;

/**
 * This function is only called when the local user makes a change to a group.
 * So this function is not called on group updates from the network, even from another of our devices.
 *
 * @param groupId the conversationID
 * @param groupName the new name (or just pass the old one if nothing changed)
 * @param members the new members (or just pass the old one if nothing changed)
 * @returns nothing
 */
async function initiateClosedGroupUpdate(
  groupId: string,
  groupName: string,
  members: Array<string>
) {
  const isGroupV2 = PubKey.is03Pubkey(groupId);
  if (isGroupV2) {
    throw new PreConditionFailed('initiateClosedGroupUpdate does not handle closedgroupv2');
  }
  const convo = await ConvoHub.use().getOrCreateAndWait(groupId, ConversationTypeEnum.GROUP);

  const expirationType = DisappearingMessages.changeToDisappearingMessageType(
    convo,
    convo.getExpireTimer(),
    convo.getExpirationMode()
  );
  const expireTimer = convo.getExpireTimer();

  if (expirationType === 'deleteAfterRead') {
    window.log.warn(`Groups cannot be deleteAfterRead. convo id: ${convo.id}`);
    throw new Error(`Groups cannot be deleteAfterRead`);
  }

  // do not give an admins field here. We don't want to be able to update admins and
  // updateOrCreateClosedGroup() will update them if given the choice.
  const groupDetails: GroupInfo = {
    id: groupId,
    name: groupName,
    members,
    // remove from the zombies list the zombies not which are not in the group anymore
    zombies: convo.getGroupZombies()?.filter(z => members.includes(z)),
    activeAt: Date.now(),
    expirationType,
    expireTimer,
  };

  const diff = buildGroupV1Diff(convo, groupDetails);
  await updateOrCreateClosedGroup(groupDetails);

  if (!diff) {
    window.log.warn('buildGroupV1Diff returned null');
    await convo.commit();

    return;
  }

  const updateObj: GroupInfo = {
    id: groupId,
    name: groupName,
    members,
    admins: convo.getGroupAdmins(),
    expireTimer: convo.get('expireTimer'),
  };

  const sharedDetails = {
    sender: UserUtils.getOurPubKeyStrFromCache(),
    sentAt: Date.now(),
    // Note: we agreed that legacy group control messages do not expire
    expireUpdate: null,
    convo,
  };

  if (diff.type === 'name' && diff.newName?.length) {
    const nameOnlyDiff: GroupDiff = _.pick(diff, ['type', 'newName']);

    const dbMessageName = await addUpdateMessage({
      diff: nameOnlyDiff,
      ...sharedDetails,
    });
    await sendNewName(convo, diff.newName, dbMessageName.id as string);
  }

  if (diff.type === 'add' && diff.added?.length) {
    const joiningOnlyDiff: GroupDiff = _.pick(diff, ['type', 'added', 'withHistory']);

    const dbMessageAdded = await addUpdateMessage({
      diff: joiningOnlyDiff,
      ...sharedDetails,
    });
    await sendAddedMembers(convo, diff.added, dbMessageAdded.id as string, updateObj);
  }

  if (diff.type === 'kicked' && diff.kicked?.length) {
    const leavingOnlyDiff: GroupDiff = _.pick(diff, ['type', 'kicked']);

    const dbMessageLeaving = await addUpdateMessage({
      diff: leavingOnlyDiff,
      ...sharedDetails,
    });
    const stillMembers = members;
    await sendRemovedMembers(convo, diff.kicked, stillMembers, dbMessageLeaving.id as string);
  }
  await convo.commit();
}

export async function addUpdateMessage({
  convo,
  diff,
  sender,
  sentAt,
  expireUpdate,
}: {
  convo: ConversationModel;
  diff: GroupDiff;
  sender: string;
  sentAt: number;
  expireUpdate: DisappearingMessageUpdate | null;
}): Promise<MessageModel> {
  const groupUpdate: MessageGroupUpdate = {};

  if (diff.type === 'name' && diff.newName) {
    groupUpdate.name = diff.newName;
  } else if (diff.type === 'add' && diff.added) {
    if (diff.withHistory) {
      groupUpdate.joinedWithHistory = diff.added;
    } else {
      groupUpdate.joined = diff.added;
    }
  } else if (diff.type === 'left' && diff.left) {
    groupUpdate.left = diff.left;
  } else if (diff.type === 'kicked' && diff.kicked) {
    groupUpdate.kicked = diff.kicked;
  } else if (diff.type === 'promoted' && diff.promoted) {
    groupUpdate.promoted = diff.promoted;
  } else if (diff.type === 'avatarChange') {
    groupUpdate.avatarChange = true;
  } else {
    throw new Error('addUpdateMessage with unknown type of change');
  }

  const isUs = UserUtils.isUsFromCache(sender);
  const msgModel: MessageAttributesOptionals = {
    sent_at: sentAt,
    group_update: groupUpdate,
    source: sender,
    conversationId: convo.id,
    type: isUs ? 'outgoing' : 'incoming',
  };

  if (convo && expireUpdate && expireUpdate.expirationType && expireUpdate.expirationTimer > 0) {
    const { expirationTimer, expirationType, isLegacyDataMessage } = expireUpdate;

    msgModel.expirationType = expirationType === 'deleteAfterSend' ? 'deleteAfterSend' : 'unknown';
    msgModel.expireTimer = msgModel.expirationType === 'deleteAfterSend' ? expirationTimer : 0;

    // NOTE Triggers disappearing for an incoming groupUpdate message
    // TODO legacy messages support will be removed in a future release
    if (isLegacyDataMessage || expirationType === 'deleteAfterSend') {
      msgModel.expirationStartTimestamp = DisappearingMessages.setExpirationStartTimestamp(
        isLegacyDataMessage ? 'legacy' : expirationType === 'unknown' ? 'off' : expirationType,
        sentAt,
        'addUpdateMessage'
      );
    }
  }

  return isUs
    ? convo.addSingleOutgoingMessage(msgModel)
    : convo.addSingleIncomingMessage({
        ...msgModel,
        source: sender,
      });
}

function buildGroupV1Diff(convo: ConversationModel, update: GroupInfo): GroupDiff | null {
  if (convo.getRealSessionUsername() !== update.name) {
    return { type: 'name', newName: update.name };
  }

  const oldMembers = convo.getGroupMembers();
  const oldZombies = convo.getGroupZombies();
  const oldMembersWithZombies = _.uniq(oldMembers.concat(oldZombies));

  const newMembersWithZombiesLeft = _.uniq(update.members.concat(update.zombies || []));

  const added = _.difference(newMembersWithZombiesLeft, oldMembersWithZombies).filter(
    PubKey.is05Pubkey
  );
  if (added.length > 0) {
    return { type: 'add', added, withHistory: false };
  }
  // Check if anyone got kicked:
  const removedMembers = _.difference(oldMembersWithZombies, newMembersWithZombiesLeft).filter(
    PubKey.is05Pubkey
  );
  if (removedMembers.length > 0) {
    return { type: 'kicked', kicked: removedMembers };
  }

  return null;
}

export async function updateOrCreateClosedGroup(details: GroupInfo) {
  // const { id, expireTimer } = details;

  const { id } = details;
  const isV3 = PubKey.is03Pubkey(id);

  const conversation = await ConvoHub.use().getOrCreateAndWait(
    id,
    isV3 ? ConversationTypeEnum.GROUPV2 : ConversationTypeEnum.GROUP
  );

  const updates: Pick<
    ConversationAttributes,
    'type' | 'members' | 'displayNameInProfile' | 'active_at' | 'left'
  > = {
    displayNameInProfile: details.name,
    members: details.members,
    type: isV3 ? ConversationTypeEnum.GROUPV2 : ConversationTypeEnum.GROUP,
    active_at: details.activeAt ? details.activeAt : 0,
    left: !details.activeAt,
  };

  conversation.set(updates);
  await conversation.unhideIfNeeded(false);

  if (details.admins?.length) {
    await conversation.updateGroupAdmins(details.admins, false);
  }

  await conversation.commit();

  console.warn('groupv2 TODO or part of libsession entirely?');
  // if (isNumber(expireTimer) && isFinite(expireTimer)) {
  //   await conversation.updateExpireTimer({}
  //     expireTimer,
  //     UserUtils.getOurPubKeyStrFromCache(),
  //     Date.now(),
  //     {
  //       fromSync: true,
  //     }
  //   );
  // }
}

async function sendNewName(convo: ConversationModel, name: string, messageId: string) {
  if (name.length === 0) {
    window?.log?.warn('No name given for group update. Skipping');
    return;
  }

  const groupId = convo.get('id');

  // Send the update to the group
  const nameChangeMessage = new ClosedGroupNameChangeMessage({
    createAtNetworkTimestamp: GetNetworkTime.now(),
    groupId,
    identifier: messageId,
    name,
    expirationType: null, // we keep that one **not** expiring
    expireTimer: 0,
  });
  await getMessageQueue().sendToGroup({
    message: nameChangeMessage,
    namespace: SnodeNamespaces.LegacyClosedGroup,
  });
}

async function sendAddedMembers(
  _convo: ConversationModel,
  addedMembers: Array<string>,
  messageId: string,
  groupUpdate: GroupInfo
) {
  if (!addedMembers?.length) {
    window?.log?.warn('No addedMembers given for group update. Skipping');
    return;
  }

  const { id: groupId, members, name: groupName } = groupUpdate;
  const admins = groupUpdate.admins || [];

  // Check preconditions
  const hexEncryptionKeyPair = await Data.getLatestClosedGroupEncryptionKeyPair(groupId);
  if (!hexEncryptionKeyPair) {
    throw new Error("Couldn't get key pair for closed group");
  }

  const encryptionKeyPair = ECKeyPair.fromHexKeyPair(hexEncryptionKeyPair);
  // Send the Added Members message to the group (only members already in the group will get it)
  const closedGroupControlMessage = new ClosedGroupAddedMembersMessage({
    createAtNetworkTimestamp: GetNetworkTime.now(),
    groupId,
    addedMembers,
    identifier: messageId,
    expirationType: null, // we keep that one **not** expiring
    expireTimer: 0,
  });
  await getMessageQueue().sendToGroup({
    message: closedGroupControlMessage,
    namespace: SnodeNamespaces.LegacyClosedGroup,
  });

  // Send closed group update messages to any new members individually
  const newClosedGroupUpdate = new ClosedGroupNewMessage({
    createAtNetworkTimestamp: GetNetworkTime.now(),
    name: groupName,
    groupId,
    admins,
    members,
    keypair: encryptionKeyPair,
    identifier: messageId || uuidv4(),
    expirationType: null, // we keep that one **not** expiring
    expireTimer: 0,
  });

  const promises = addedMembers.map(async m => {
    await ConvoHub.use().getOrCreateAndWait(m, ConversationTypeEnum.PRIVATE);
    const memberPubKey = PubKey.cast(m);
    await getMessageQueue().sendToPubKey(
      memberPubKey,
      newClosedGroupUpdate,
      SnodeNamespaces.Default
    );
  });
  await Promise.all(promises);
}

async function sendRemovedMembers(
  convo: ConversationModel,
  removedMembers: Array<string>,
  stillMembers: Array<string>,
  messageId?: string
) {
  if (!removedMembers?.length) {
    window?.log?.warn('No removedMembers given for group update. Skipping');
    return;
  }
  const ourNumber = UserUtils.getOurPubKeyFromCache();
  const admins = convo.getGroupAdmins() || [];
  const groupId = convo.get('id');

  const isCurrentUserAdmin = admins.includes(ourNumber.key);
  const isUserLeaving = removedMembers.includes(ourNumber.key);
  if (isUserLeaving) {
    throw new Error('Cannot remove members and leave the group at the same time');
  }
  if (removedMembers.includes(admins[0]) && stillMembers.length !== 0) {
    throw new Error("Can't remove admin from closed group without removing everyone.");
  }
  // Send the update to the group and generate + distribute a new encryption key pair if needed
  const mainClosedGroupControlMessage = new ClosedGroupRemovedMembersMessage({
    createAtNetworkTimestamp: GetNetworkTime.now(),
    groupId,
    removedMembers,
    identifier: messageId,
    expirationType: null, // we keep that one **not** expiring
    expireTimer: 0,
  });
  // Send the group update, and only once sent, generate and distribute a new encryption key pair if needed
  await getMessageQueue().sendToGroup({
    message: mainClosedGroupControlMessage,
    namespace: SnodeNamespaces.LegacyClosedGroup,
    sentCb: async () => {
      if (isCurrentUserAdmin) {
        // we send the new encryption key only to members already here before the update
        window?.log?.info(
          `Sending group update: A user was removed from ${groupId} and we are the admin. Generating and sending a new EncryptionKeyPair`
        );

        await generateAndSendNewEncryptionKeyPair(groupId, stillMembers);
      }
    },
  });
}

async function generateAndSendNewEncryptionKeyPair(
  groupPublicKey: string,
  targetMembers: Array<string>
) {
  const groupConvo = ConvoHub.use().get(groupPublicKey);
  const groupId = fromHexToArray(groupPublicKey);

  if (!groupConvo) {
    window?.log?.warn(
      'generateAndSendNewEncryptionKeyPair: conversation not found',
      groupPublicKey
    );
    return;
  }
  if (!groupConvo.isClosedGroup()) {
    window?.log?.warn(
      'generateAndSendNewEncryptionKeyPair: conversation not a closed group',
      groupPublicKey
    );
    return;
  }

  const ourNumber = UserUtils.getOurPubKeyStrFromCache();
  if (!groupConvo.getGroupAdmins().includes(ourNumber)) {
    window?.log?.warn('generateAndSendNewEncryptionKeyPair: cannot send it as a non admin');
    return;
  }

  // Generate the new encryption key pair
  const newKeyPair = await generateCurve25519KeyPairWithoutPrefix();

  if (!newKeyPair) {
    window?.log?.warn('generateAndSendNewEncryptionKeyPair: failed to generate new keypair');
    return;
  }
  // Distribute it
  const wrappers = await buildEncryptionKeyPairWrappers(targetMembers, newKeyPair);

  const keypairsMessage = new ClosedGroupEncryptionPairMessage({
    groupId: toHex(groupId),
    createAtNetworkTimestamp: GetNetworkTime.now(),
    encryptedKeyPairs: wrappers,
    expirationType: null, // we keep that one **not** expiring
    expireTimer: 0,
  });

  distributingClosedGroupEncryptionKeyPairs.set(toHex(groupId), newKeyPair);

  const messageSentCallback = async () => {
    window?.log?.info(
      `KeyPairMessage for ClosedGroup ${groupPublicKey} is sent. Saving the new encryptionKeyPair.`
    );

    distributingClosedGroupEncryptionKeyPairs.delete(toHex(groupId));

    await addKeyPairToCacheAndDBIfNeeded(toHex(groupId), newKeyPair.toHexKeyPair());
    await groupConvo?.commit(); // this makes sure to include the new encryption keypair in the libsession usergroup wrapper
  };

  // this is to be sent to the group pubkey address
  await getMessageQueue().sendToGroup({
    message: keypairsMessage,
    namespace: SnodeNamespaces.LegacyClosedGroup,
    sentCb: messageSentCallback,
  });
}

async function buildEncryptionKeyPairWrappers(
  targetMembers: Array<string>,
  encryptionKeyPair: ECKeyPair
) {
  if (
    !encryptionKeyPair ||
    !encryptionKeyPair.publicKeyData.length ||
    !encryptionKeyPair.privateKeyData.length
  ) {
    throw new Error('buildEncryptionKeyPairWrappers() needs a valid encryptionKeyPair set');
  }

  const proto = new SignalService.KeyPair({
    privateKey: encryptionKeyPair?.privateKeyData,
    publicKey: encryptionKeyPair?.publicKeyData,
  });
  const plaintext = SignalService.KeyPair.encode(proto).finish();

  const wrappers = await Promise.all(
    targetMembers.map(async pubkey => {
      const ciphertext = await encryptUsingSessionProtocol(PubKey.cast(pubkey), plaintext);
      return new SignalService.DataMessage.ClosedGroupControlMessage.KeyPairWrapper({
        encryptedKeyPair: ciphertext,
        publicKey: fromHexToArray(pubkey),
      });
    })
  );
  return wrappers;
}

export const ClosedGroup = {
  addUpdateMessage,
  initiateClosedGroupUpdate,
  updateOrCreateClosedGroup,
  buildEncryptionKeyPairWrappers,
};

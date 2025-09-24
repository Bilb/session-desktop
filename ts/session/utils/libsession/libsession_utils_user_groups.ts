/* eslint-disable no-case-declarations */
import { CommunityInfo } from 'libsession_util_nodejs';
import { ConversationModel } from '../../../models/conversation';
import { UserGroupsWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { PubKey } from '../../types';
import { LibsessionUtilUserWasm } from '../../../libsession/user/userWrappers';

/**
 * Returns true if that conversation is an active group
 */
function isUserGroupToStoreInWrapper(convo: ConversationModel): boolean {
  return isCommunityToStoreInWrapper(convo) || isGroupToStoreInWrapper(convo);
}

function isCommunityToStoreInWrapper(convo: ConversationModel): boolean {
  return convo.isGroup() && convo.isPublic() && convo.isActive();
}

function isGroupToStoreInWrapper(convo: ConversationModel): boolean {
  return convo.isGroup() && PubKey.is03Pubkey(convo.id) && convo.isActive();
}

async function getCommunityByConvoIdNotCached(convoId: string) {
  return UserGroupsWrapperActions.getCommunityByFullUrl(convoId);
}

async function getAllCommunitiesNotCached(): Promise<Array<CommunityInfo>> {
  const communities = LibsessionUtilUserWasm.getUserGroups().allCommunities();
  const communitiesArray: Array<CommunityInfo> = [];
  for (let index = 0; index < communities.size(); index++) {
    const element = communities.get(index);
    if (!element) {
      throw new Error('getAllCommunitiesNotCached: element is null');
    }
    communitiesArray.push({
      baseUrl: element.baseUrl(),
      roomCasePreserved: element.room(),
      fullUrlWithPubkey: element.fullUrl(),
      priority: element.priority,
      pubkeyHex: element.pubkeyHex(),
    });
  }
  return communitiesArray;
}

/**
 * Removes the matching community from the wrapper and from the cached list of communities
 */
async function removeCommunityFromWrapper(_convoId: string, fullUrlWithOrWithoutPubkey: string) {
  try {
    const fromWrapper = LibsessionUtilUserWasm.getUserGroups().getOrConstructCommunity(
      fullUrlWithOrWithoutPubkey
    );

    if (fromWrapper) {
      LibsessionUtilUserWasm.getUserGroups().eraseCommunity(
        fromWrapper.baseUrl(),
        fromWrapper.room()
      );
    }
  } catch (e) {
    console.warn('removeCommunityFromWrapper failed with', e.message);
  }
}

/**
 * This function can be used where there are things to do for all the types handled by this wrapper.
 * You can do a loop on all the types handled by this wrapper and have a switch using assertUnreachable to get errors when not every case is handled.
 *
 *
 * Note: Ideally, we'd like to have this type in the wrapper index.d.ts,
 * but it would require it to be a index.ts instead, which causes a
 * whole other bunch of issues because it is a native node module.
 */
function getUserGroupTypes() {
  return ['Community', 'Group'] as const;
}

export const SessionUtilUserGroups = {
  // shared
  isUserGroupToStoreInWrapper,
  getUserGroupTypes,

  // communities
  isCommunityToStoreInWrapper,
  getAllCommunitiesNotCached,
  getCommunityByConvoIdNotCached,
  removeCommunityFromWrapper,

  // group 03
  isGroupToStoreInWrapper,
};

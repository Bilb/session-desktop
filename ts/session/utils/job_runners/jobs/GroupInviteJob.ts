import { GroupPubkeyType, PubkeyType } from 'libsession_util_nodejs';
import { debounce, difference, isNumber } from 'lodash';
import { v4 } from 'uuid';
import { ToastUtils, UserUtils } from '../..';
import { groupInfoActions } from '../../../../state/ducks/metaGroups';
import {
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../../../../webworker/workers/browser/libsession_worker_interface';
import { SnodeNamespaces } from '../../../apis/snode_api/namespaces';
import { SnodeGroupSignature } from '../../../apis/snode_api/signature/groupSignature';
import { getMessageQueue } from '../../../sending';
import { PubKey } from '../../../types';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  GroupInvitePersistedData,
  PersistedJob,
  RunJobResult,
} from '../PersistedJob';
import { LibSessionUtil } from '../../libsession/libsession_utils';
import { showUpdateGroupMembersByConvoId } from '../../../../interactions/conversationInteractions';
import { ConvoHub } from '../../../conversations';

const defaultMsBetweenRetries = 10000;
const defaultMaxAttempts = 1;

type JobExtraArgs = {
  groupPk: GroupPubkeyType;
  member: PubkeyType;
};

export function shouldAddJob(args: JobExtraArgs) {
  if (UserUtils.isUsFromCache(args.member)) {
    return false;
  }

  return true;
}

const invitesFailed = new Map<
  GroupPubkeyType,
  {
    debouncedCall: (groupPk: GroupPubkeyType) => void;
    failedMembers: Array<PubkeyType>;
  }
>();

async function addJob({ groupPk, member }: JobExtraArgs) {
  if (shouldAddJob({ groupPk, member })) {
    const groupInviteJob = new GroupInviteJob({
      groupPk,
      member,
      nextAttemptTimestamp: Date.now(),
    });
    window.log.debug(`addGroupInviteJob: adding group invite for ${groupPk}:${member} `);

    window?.inboxStore?.dispatch(
      groupInfoActions.refreshGroupDetailsFromWrapper({ groupPk }) as any
    );
    await LibSessionUtil.saveDumpsToDb(groupPk);

    await runners.groupInviteJobRunner.addJob(groupInviteJob);

    window?.inboxStore?.dispatch(
      groupInfoActions.setInvitePending({ groupPk, pubkey: member, sending: true })
    );
  }
}

function displayFailedInvitesForGroup(groupPk: GroupPubkeyType) {
  const thisGroupFailures = invitesFailed.get(groupPk);

  if (!thisGroupFailures || thisGroupFailures.failedMembers.length === 0) {
    return;
  }
  const onToastClick = () => {
    void showUpdateGroupMembersByConvoId(groupPk);
  };
  const count = thisGroupFailures.failedMembers.length;
  const groupName = ConvoHub.use().get(groupPk)?.getRealSessionUsername() || window.i18n('unknown');
  const firstUserName =
    ConvoHub.use().get(thisGroupFailures.failedMembers?.[0])?.getRealSessionUsername() ||
    window.i18n('unknown');
  const secondUserName =
    ConvoHub.use().get(thisGroupFailures.failedMembers?.[1])?.getRealSessionUsername() ||
    window.i18n('unknown');
  switch (count) {
    case 1:
      ToastUtils.pushToastWarning(
        `invite-failed${groupPk}`,
        window.i18n('groupInviteFailedUser', { group_name: groupName, name: firstUserName }),
        onToastClick
      );
      break;
    case 2:
      ToastUtils.pushToastWarning(
        `invite-failed${groupPk}`,
        window.i18n('groupInviteFailedTwo', {
          group_name: groupName,
          name: firstUserName,
          other_name: secondUserName,
        }),
        onToastClick
      );
      break;
    default:
      ToastUtils.pushToastWarning(
        `invite-failed${groupPk}`,
        window.i18n('groupInviteFailedMultiple', {
          group_name: groupName,
          name: firstUserName,
          count: thisGroupFailures.failedMembers.length - 1,
        }),
        onToastClick
      );
  }
  // toast was displayed empty the list
  thisGroupFailures.failedMembers = [];
}

class GroupInviteJob extends PersistedJob<GroupInvitePersistedData> {
  constructor({
    groupPk,
    member,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    identifier,
  }: Pick<GroupInvitePersistedData, 'groupPk' | 'member'> &
    Partial<
      Pick<
        GroupInvitePersistedData,
        | 'nextAttemptTimestamp'
        | 'identifier'
        | 'maxAttempts'
        | 'delayBetweenRetries'
        | 'currentRetry'
      >
    >) {
    super({
      jobType: 'GroupInviteJobType',
      identifier: identifier || v4(),
      member,
      groupPk,
      delayBetweenRetries: defaultMsBetweenRetries,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : defaultMaxAttempts,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + defaultMsBetweenRetries,
      currentRetry: isNumber(currentRetry) ? currentRetry : 0,
    });
  }

  public async run(): Promise<RunJobResult> {
    const { groupPk, member, jobType, identifier } = this.persistedData;

    window.log.info(
      `running job ${jobType} with groupPk:"${groupPk}" member: ${member} id:"${identifier}" `
    );
    const group = await UserGroupsWrapperActions.getGroup(groupPk);
    if (!group || !group.secretKey || !group.name) {
      window.log.warn(`GroupInviteJob: Did not find group in wrapper or no valid info in wrapper`);
      return RunJobResult.PermanentFailure;
    }

    if (UserUtils.isUsFromCache(member)) {
      return RunJobResult.Success; // nothing to do for us, we get the update from our user's libsession wrappers
    }
    let failed = true;
    try {
      const inviteDetails = window.sessionFeatureFlags.useGroupV2InviteAsAdmin
        ? await SnodeGroupSignature.getGroupPromoteMessage({
            groupName: group.name,
            member,
            secretKey: group.secretKey,
            groupPk,
          })
        : await SnodeGroupSignature.getGroupInviteMessage({
            groupName: group.name,
            member,
            secretKey: group.secretKey,
            groupPk,
          });

      const storedAt = await getMessageQueue().sendTo1o1NonDurably({
        message: inviteDetails,
        namespace: SnodeNamespaces.Default,
        pubkey: PubKey.cast(member),
      });
      if (storedAt !== null) {
        failed = false;
      }
    } catch (e) {
      window.log.warn(
        `${jobType} with groupPk:"${groupPk}" member: ${member} id:"${identifier}" failed with ${e.message}`
      );
      failed = true;
    } finally {
      window.log.info(
        `${jobType} with groupPk:"${groupPk}" member: ${member} id:"${identifier}" finished. failed:${failed}`
      );
      try {
        await MetaGroupWrapperActions.memberSetInvited(groupPk, member, failed);
      } catch (e) {
        window.log.warn('GroupInviteJob memberSetInvited failed with', e.message);
      }

      updateFailedStateForMember(groupPk, member, failed);
      window?.inboxStore?.dispatch(
        groupInfoActions.setInvitePending({ groupPk, pubkey: member, sending: false })
      );
      window?.inboxStore?.dispatch(
        groupInfoActions.refreshGroupDetailsFromWrapper({ groupPk }) as any
      );
      await LibSessionUtil.saveDumpsToDb(groupPk);
    }
    // return true so this job is marked as a success and we don't need to retry it
    return RunJobResult.Success;
  }

  public serializeJob(): GroupInvitePersistedData {
    return super.serializeBase();
  }

  public nonRunningJobsToRemove(_jobs: Array<GroupInvitePersistedData>) {
    return [];
  }

  public addJobCheck(jobs: Array<GroupInvitePersistedData>): AddJobCheckReturn {
    // avoid adding the same job if the exact same one is already planned
    const hasSameJob = jobs.some(j => {
      return j.groupPk === this.persistedData.groupPk && j.member === this.persistedData.member;
    });

    if (hasSameJob) {
      return 'skipAddSameJobPresent';
    }

    return null;
  }

  public getJobTimeoutMs(): number {
    return 15000;
  }
}

export const GroupInvite = {
  GroupInviteJob,
  addJob,
};
function updateFailedStateForMember(groupPk: GroupPubkeyType, member: PubkeyType, failed: boolean) {
  let thisGroupFailure = invitesFailed.get(groupPk);

  if (!failed) {
    // invite sent success, remove a pending failure state from the list of toasts to display
    if (thisGroupFailure) {
      thisGroupFailure.failedMembers = difference(thisGroupFailure.failedMembers, [member]);
    }

    return;
  }
  // invite sent failed, append the member to that groupFailure member list, and trigger the debounce call
  if (!thisGroupFailure) {
    thisGroupFailure = {
      failedMembers: [],
      debouncedCall: debounce(displayFailedInvitesForGroup, 1000), // TODO change to 5000
    };
  }

  if (!thisGroupFailure.failedMembers.includes(member)) {
    thisGroupFailure.failedMembers.push(member);
  }

  invitesFailed.set(groupPk, thisGroupFailure);
  thisGroupFailure.debouncedCall(groupPk);
}

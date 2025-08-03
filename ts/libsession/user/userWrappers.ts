import type { PushConfigResult, ContactInfo } from 'libsession_util_nodejs';
/* eslint-disable no-console */
import type { ConfigBase, EmbindModule, ProfilePic } from '@session-foundation/libsession-wasm';
import { from_hex, to_hex } from 'libsodium-wrappers-sumo';
import { assertUnreachable, type ConfigDumpRow } from '../../types/sqlSharedTypes';
import { getLibSessionInstance, libsessionReady } from '../libsession';
import {
  buildUserMergeVector,
  stringArrayToWasmVector,
  wasmVectorToArray,
} from '../base/baseWrapper';
import { isEmpty } from 'lodash';

let userProfile: InstanceType<EmbindModule['UserProfileW']> | null = null;
let userContacts: InstanceType<EmbindModule['ContactsW']> | null = null;
let convoVolatile: InstanceType<EmbindModule['ConvoInfoVolatileW']> | null = null;
let userGroups: InstanceType<EmbindModule['UserGroupsW']> | null = null;

export type UserConfigWasmType = 'UserConfig' | 'ContactsConfig';

const requiredWasmUserVariants: Array<UserConfigWasmType> = ['UserConfig', 'ContactsConfig'];

function getWrapperFromVariant(variant: UserConfigWasmType) {
  if (variant === 'UserConfig') {
    return getUserProfile();
  }
  if (variant === 'ContactsConfig') {
    return getUserContacts();
  }
  assertUnreachable(variant, 'getWrapperFromVariant: unknown variant');
  throw new Error('assertUnreachable failed');
}

function wasmUserMethodCallNoArgs<
  K extends 'needsDump' | 'needsPush' | 'dumpHex' | 'activeHashes' | 'makeDumpHex',
>(variant: UserConfigWasmType, method: K): ReturnType<ConfigBase[K]> {
  const instance = getWrapperFromVariant(variant);
  return instance[method]() as ReturnType<ConfigBase[K]>;
}

function wasmNeedsDump(variant: UserConfigWasmType) {
  return wasmUserMethodCallNoArgs(variant, 'needsDump');
}

function wasmNeedsPush(variant: UserConfigWasmType) {
  return wasmUserMethodCallNoArgs(variant, 'needsPush');
}

function wasmDumpHex(variant: UserConfigWasmType) {
  return wasmUserMethodCallNoArgs(variant, 'dumpHex');
}

function wasmActiveHashes(variant: UserConfigWasmType) {
  return wasmVectorToArray(wasmUserMethodCallNoArgs(variant, 'activeHashes'));
}

function wasmMakeDumpHex(variant: UserConfigWasmType) {
  return wasmUserMethodCallNoArgs(variant, 'makeDumpHex');
}

function wasmConfirmPushed(
  variant: UserConfigWasmType,
  { hashes, seqno }: { seqno: number; hashes: Array<string> }
) {
  return getWrapperFromVariant(variant).confirmPushed(seqno, stringArrayToWasmVector(hashes));
}

function wasmMergeHex(
  variant: UserConfigWasmType,
  content: Array<{ data: Uint8Array<ArrayBuffer>; hash: string }>
) {
  return wasmVectorToArray(getWrapperFromVariant(variant).mergeHex(buildUserMergeVector(content)));
}

function wasmPush(variant: UserConfigWasmType): PushConfigResult {
  const { dataHex, hashes, seqno, storageNamespace } = getWrapperFromVariant(variant).pushHex();
  return {
    namespace: storageNamespace.value,
    seqno,
    hashes: wasmVectorToArray(hashes),
    data: wasmVectorToArray(dataHex).map(from_hex),
  };
}

function isWasmUserConfigWrapperType(config: string): config is UserConfigWasmType {
  return config === 'UserConfig';
}

async function initUserWrapperWithDumps(
  userPrivateEdKey: Uint8Array<ArrayBufferLike>,
  variantsWithData: Array<ConfigDumpRow>
) {
  await libsessionReady();
  const userProfileDump = variantsWithData.find(m => m.variant === 'UserConfig')?.data;
  const userContactsDump = variantsWithData.find(m => m.variant === 'ContactsConfig')?.data;
  const convoVolatileDump = variantsWithData.find(
    m => m.variant === 'ConvoInfoVolatileConfig'
  )?.data;
  const userGroupsDump = variantsWithData.find(m => m.variant === 'UserGroupsConfig')?.data;

  const libsession = getLibSessionInstance();
  userProfile = new libsession.UserProfileW(
    to_hex(userPrivateEdKey),
    userProfileDump ? to_hex(userProfileDump) : undefined
  );
  console.warn('userProfile', userProfile);

  userContacts = new libsession.ContactsW(
    to_hex(userPrivateEdKey),
    userContactsDump ? to_hex(userContactsDump) : undefined
  );

  console.warn('userContacts', userContacts);
  const contacts = userContacts.all();
  for (let index = 0; index < contacts.size(); index++) {
    const element = contacts.get(index);
    console.warn('userContacts entry', element?.sessionId, element?.createdAtSeconds);
  }

  userGroups = new libsession.UserGroupsW(
    to_hex(userPrivateEdKey),
    userGroupsDump ? to_hex(userGroupsDump) : undefined
  );
  console.warn('userGroups', userGroups);

  convoVolatile = new libsession.ConvoInfoVolatileW(
    to_hex(userPrivateEdKey),
    convoVolatileDump ? to_hex(convoVolatileDump) : undefined
  );
  console.warn('convoVolatile', convoVolatile);

  const arr = convoVolatile.getAll1o1s();
  for (let index = 0; index < arr.size(); index++) {
    const element = arr.get(index);
    console.warn('convoVolatile entry', element?.sessionId, element?.lastReadMs);
  }
}

function getUserProfile() {
  if (!userProfile) {
    throw new Error('userProfile not ready. call and await initUserWrapperWithDumps first');
  }
  return userProfile;
}

function getUserContacts() {
  if (!userContacts) {
    throw new Error('userContacts not ready. call and await initUserWrapperWithDumps first');
  }
  return userContacts;
}

function getUserGroups() {
  if (!userGroups) {
    throw new Error('userGroups not ready. call and await initUserWrapperWithDumps first');
  }
  return userGroups;
}

function getConvoVolatile() {
  if (!convoVolatile) {
    throw new Error('convoVolatile not ready. call and await initUserWrapperWithDumps first');
  }
  return convoVolatile;
}

function mapWasmVector<T, R>(
  vector: { size(): number; get(index: number): T },
  callback: (item: T, index: number) => R
): Array<R> {
  const result: Array<R> = [];
  const length = vector.size();

  for (let i = 0; i < length; i++) {
    const item = vector.get(i);
    if (item !== undefined && item !== null) {
      result.push(callback(item, i));
    }
  }
  return result;
}

function wasmGetAllContacts(): Array<ContactInfo> {
  const contacts = getUserContacts().all();

  return mapWasmVector(contacts, (contact, index) => {
    if (!contact) {
      throw new Error(`wasmGetAllContacts: contact ${index} is null`);
    }

    const info: ContactInfo = {
      id: contact.sessionId,
      name: contact.name,
      profilePicture: {
        key: contact.profilePicture.key ? from_hex(contact.profilePicture.key) : null,
        url: contact.profilePicture.url,
      },
      createdAtSeconds: contact.createdAtSeconds,
      blocked: contact.blocked,
      approved: contact.approved,
      approvedMe: contact.approvedMe,
      priority: contact.priority,
    };
    return info;
  });
}

function getWasmProfilePic({ key, url }: { url?: string; key?: Uint8Array }): ProfilePic {
  const libsession = getLibSessionInstance();
  const profilePicture = new libsession.ProfilePic();

  if (key && url && !isEmpty(key)) {
    profilePicture.key = to_hex(key);
    profilePicture.url = url;
  }
  return profilePicture;
}

export const LibsessionUtilUserWasm = {
  requiredWasmUserVariants,
  wasmNeedsDump,
  wasmNeedsPush,
  wasmDumpHex,
  wasmActiveHashes,
  wasmConfirmPushed,
  wasmMakeDumpHex,
  wasmMergeHex,
  wasmPush,
  isWasmUserConfigWrapperType,
  getUserProfile,
  getUserContacts,
  getUserGroups,
  getConvoVolatile,
  initUserWrapperWithDumps,
  wasmGetAllContacts,
  getWasmProfilePic
};

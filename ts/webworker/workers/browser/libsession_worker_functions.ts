import {
  BaseConfigActions,
  ContactsConfigActionsType,
  ConvoInfoVolatileConfigActionsType,
  GroupPubkeyType,
  MetaGroupActionsType,
  UserConfigActionsType,
  UserGroupsConfigActionsType,
} from 'libsession_util_nodejs';

// we can only have one of those wrapper for our current user (but we can have a few configs for it to be merged into one)
export type UserConfig = 'UserConfig';
export type ContactsConfig = 'ContactsConfig';
export type UserGroupsConfig = 'UserGroupsConfig';
export type ConvoInfoVolatileConfig = 'ConvoInfoVolatileConfig';

export const MetaGroupConfigValue = 'MetaGroupConfig-';
type MetaGroupConfigType = typeof MetaGroupConfigValue;
export type MetaGroupConfig = `${MetaGroupConfigType}${GroupPubkeyType}`;


export type ConfigWrapperUser =
  | UserConfig
  | ContactsConfig
  | UserGroupsConfig
  | ConvoInfoVolatileConfig;


export type ConfigWrapperGroup = MetaGroupConfig;

export type ConfigWrapperObjectTypesMeta =
  | ConfigWrapperUser
  | ConfigWrapperGroup;


  export type ConfigWrapperGroupDetailed = 'GroupInfo' | 'GroupMember'| 'GroupKeys';

  export type ConfigWrapperObjectTypesDetailed =
  | ConfigWrapperUser
  | ConfigWrapperGroupDetailed;

type UserConfigFunctions =
  | [UserConfig, ...BaseConfigActions]
  | [UserConfig, ...UserConfigActionsType];
type ContactsConfigFunctions =
  | [ContactsConfig, ...BaseConfigActions]
  | [ContactsConfig, ...ContactsConfigActionsType];
type UserGroupsConfigFunctions =
  | [UserGroupsConfig, ...BaseConfigActions]
  | [UserGroupsConfig, ...UserGroupsConfigActionsType];
type ConvoInfoVolatileConfigFunctions =
  | [ConvoInfoVolatileConfig, ...BaseConfigActions]
  | [ConvoInfoVolatileConfig, ...ConvoInfoVolatileConfigActionsType];

// Group-related calls
type MetaGroupFunctions =
  | [MetaGroupConfig, ...MetaGroupActionsType]


export type LibSessionWorkerFunctions =
  | UserConfigFunctions
  | ContactsConfigFunctions
  | UserGroupsConfigFunctions
  | ConvoInfoVolatileConfigFunctions
  | MetaGroupFunctions;

export function isUserConfigWrapperType(config: ConfigWrapperObjectTypesMeta): config is ConfigWrapperUser {
  return (
    config === 'ContactsConfig' ||
    config === 'UserConfig' ||
    config === 'ConvoInfoVolatileConfig' ||
    config === 'UserGroupsConfig'
  );
}

export function isMetaWrapperType(config: ConfigWrapperObjectTypesMeta): config is MetaGroupConfig {
  return config.startsWith(MetaGroupConfigValue);
}


export function getGroupPubkeyFromWrapperType(type: ConfigWrapperGroup): GroupPubkeyType {
  if (!type.startsWith(MetaGroupConfigValue + '03')) {
    throw new Error(`not a metagroup variant: ${type}`)
  }
  return type.substring(type.indexOf('-03') + 1) as GroupPubkeyType; // typescript is not yet smart enough
}



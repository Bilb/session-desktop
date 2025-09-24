import type {
  BlindingActionsType,
  GroupPubkeyType,
  MetaGroupActionsType,
  MultiEncryptActionsType,
  UtilitiesActionsType,
} from 'libsession_util_nodejs';

// we can only have one of those wrapper for our current user (but we can have a few configs for it to be merged into one)

export const MetaGroupConfigValue = 'MetaGroupConfig-';
export const MultiEncryptConfigValue = 'MultiEncrypt';
export const BlindedConfigValue = 'Blinding';
export const UtilitiesValue = 'Utilities';

type MetaGroupConfigType = typeof MetaGroupConfigValue;
export type MetaGroupConfig = `${MetaGroupConfigType}${GroupPubkeyType}`;
export type MultiEncryptConfig = typeof MultiEncryptConfigValue;
export type BlindingConfig = typeof BlindedConfigValue;
export type UtilitiesConfig = typeof UtilitiesValue;

export type ConfigWrapperGroup = MetaGroupConfig;

export type ConfigWrapperObjectTypesMeta =
  | ConfigWrapperGroup
  | MultiEncryptConfig
  | BlindingConfig
  | UtilitiesConfig;

export type ConfigWrapperGroupDetailed = 'GroupInfo' | 'GroupMember' | 'GroupKeys';

export type ConfigWrapperObjectTypesDetailed = ConfigWrapperGroupDetailed;

type BlindingFunctions = ['Blinding', ...BlindingActionsType];
type UtilitiesFunctions = ['Utilities', ...UtilitiesActionsType];

// Group-related calls
type MetaGroupFunctions = [MetaGroupConfig, ...MetaGroupActionsType];

type MultiEncryptFunctions = [MultiEncryptConfig, ...MultiEncryptActionsType];

export type LibSessionWorkerFunctions =
  | MetaGroupFunctions
  | BlindingFunctions
  | MultiEncryptFunctions
  | UtilitiesFunctions;

export function isMetaGroupWrapperType(config: string): config is MetaGroupConfig {
  return config.startsWith(MetaGroupConfigValue);
}

export function isMultiEncryptWrapperType(
  config: ConfigWrapperObjectTypesMeta
): config is MultiEncryptConfig {
  return config === 'MultiEncrypt';
}

export function isBlindingWrapperType(
  config: ConfigWrapperObjectTypesMeta
): config is BlindingConfig {
  return config === 'Blinding';
}

export function isUtilitiesWrapperType(
  config: ConfigWrapperObjectTypesMeta
): config is UtilitiesConfig {
  return config === 'Utilities';
}

export function getGroupPubkeyFromWrapperType(type: ConfigWrapperGroup): GroupPubkeyType {
  if (!type.startsWith(`${MetaGroupConfigValue}03`)) {
    throw new Error(`not a metagroup variant: ${type}`);
  }
  return type.substring(type.indexOf('-03') + 1) as GroupPubkeyType; // typescript is not yet smart enough
}

/**
 * A static wrapper does not need to be init, all its functions are static.
 */
export function isStaticSessionWrapper(
  config: ConfigWrapperObjectTypesMeta
): config is 'Blinding' | 'MultiEncrypt' | 'Utilities' {
  return (
    isMultiEncryptWrapperType(config) ||
    isBlindingWrapperType(config) ||
    isUtilitiesWrapperType(config)
  );
}

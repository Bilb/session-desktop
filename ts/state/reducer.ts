import { combineReducers } from '@reduxjs/toolkit';

import { callReducer as call, type CallStateType } from './ducks/call';
import { reducer as conversations, type ConversationsStateType } from './ducks/conversations';
import { defaultRoomReducer as defaultRooms, type DefaultRoomsState } from './ducks/defaultRooms';
import { reducer as primaryColor } from './ducks/primaryColor';
import { reducer as search, type SearchStateType } from './ducks/search';
import { reducer as section, type SectionStateType } from './ducks/section';
import { ReduxSogsRoomInfos, type SogsRoomInfoState } from './ducks/sogsRoomInfo';
import { reducer as theme } from './ducks/theme';
import { reducer as user, type UserStateType } from './ducks/user';

import type { PrimaryColorStateType, ThemeStateType } from '../themes/constants/colors';
import { groupReducer, type GroupState } from './ducks/metaGroups';
import { modalReducer as modals, type ModalState } from './ducks/modalDialog';
import { defaultOnionReducer as onionPaths, type OnionState } from './ducks/onion';
import { settingsReducer, type SettingsState } from './ducks/settings';
import {
  reducer as stagedAttachments,
  type StagedAttachmentsStateType,
} from './ducks/stagedAttachments';
import { userConfigReducer as userConfig, type UserConfigState } from './ducks/userConfig';
import { userGroupReducer, type UserGroupState } from './ducks/userGroups';
import { releasedFeaturesReducer, type ReleasedFeaturesState } from './ducks/releasedFeatures';
import { debugReducer, type DebugState } from './ducks/debug';

export type StateType = {
  search: SearchStateType;
  user: UserStateType;
  conversations: ConversationsStateType;
  theme: ThemeStateType;
  primaryColor: PrimaryColorStateType;
  section: SectionStateType;
  defaultRooms: DefaultRoomsState;
  onionPaths: OnionState;
  modals: ModalState;
  userConfig: UserConfigState;
  stagedAttachments: StagedAttachmentsStateType;
  call: CallStateType;
  sogsRoomInfo: SogsRoomInfoState;
  settings: SettingsState;
  groups: GroupState;
  userGroups: UserGroupState;
  releasedFeatures: ReleasedFeaturesState;
  debug: DebugState;
};

const reducers = {
  search,
  conversations,
  user,
  theme,
  primaryColor,
  section,
  defaultRooms,
  onionPaths,
  modals,
  userConfig,
  stagedAttachments,
  call,
  sogsRoomInfo: ReduxSogsRoomInfos.sogsRoomInfoReducer,
  settings: settingsReducer,
  groups: groupReducer,
  userGroups: userGroupReducer,
  releasedFeatures: releasedFeaturesReducer,
  debug: debugReducer,
};

// Making this work would require that our reducer signature supported AnyAction, not
//   our restricted actions
export const rootReducer = combineReducers(reducers);

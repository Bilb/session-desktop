import { combineReducers } from '@reduxjs/toolkit';

import { reducer as search, SearchStateType } from './ducks/search';
import { ConversationsStateType, reducer as conversations } from './ducks/conversations';
import { reducer as user, UserStateType } from './ducks/user';
import { reducer as theme } from './ducks/theme';
import { reducer as primaryColor } from './ducks/primaryColor';
import { reducer as section, SectionStateType } from './ducks/section';
import { defaultRoomReducer as defaultRooms, DefaultRoomsState } from './ducks/defaultRooms';
import { ReduxSogsRoomInfos, SogsRoomInfoState } from './ducks/sogsRoomInfo';
import { callReducer as call, CallStateType } from './ducks/call';

import { defaultOnionReducer as onionPaths, OnionState } from './ducks/onion';
import { modalReducer as modals, ModalState } from './ducks/modalDialog';
import { userConfigReducer as userConfig, UserConfigState } from './ducks/userConfig';
import { timerOptionReducer as timerOptions, TimerOptionsState } from './ducks/timerOptions';
import {
  reducer as stagedAttachments,
  StagedAttachmentsStateType,
} from './ducks/stagedAttachments';
import { PrimaryColorStateType, ThemeStateType } from '../themes/constants/colors';
import { settingsReducer, SettingsState } from './ducks/settings';
import { groupReducer, GroupState } from './ducks/groups';

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
  timerOptions: TimerOptionsState;
  stagedAttachments: StagedAttachmentsStateType;
  call: CallStateType;
  sogsRoomInfo: SogsRoomInfoState;
  settings: SettingsState;
  groups: GroupState;
};

export const reducers = {
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
  timerOptions,
  stagedAttachments,
  call,
  sogsRoomInfo: ReduxSogsRoomInfos.sogsRoomInfoReducer,
  settings: settingsReducer,
  groups: groupReducer,
};

// Making this work would require that our reducer signature supported AnyAction, not
//   our restricted actions
export const rootReducer = combineReducers(reducers);

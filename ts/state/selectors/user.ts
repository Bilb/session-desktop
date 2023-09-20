import { createSelector } from '@reduxjs/toolkit';

import { useSelector } from 'react-redux';
import { LocalizerType } from '../../types/Util';

import { StateType } from '../reducer';
import { UserStateType } from '../ducks/user';

export const getUser = (state: StateType): UserStateType => state.user;

export const getOurNumber = createSelector(
  getUser,
  (state: UserStateType): string => state.ourNumber
);

export const getIntl = createSelector(getUser, (): LocalizerType => window.i18n);

export function useOurPkStr() {
  return useSelector((state: StateType) => getOurNumber(state));
}

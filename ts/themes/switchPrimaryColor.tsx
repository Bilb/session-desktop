import { find } from 'lodash';
import type { Dispatch } from '@reduxjs/toolkit';
import { applyPrimaryColor } from '../state/ducks/primaryColor';
import type { ColorsType, PrimaryColorStateType } from './constants/colors';
import { COLORS, getPrimaryColors } from './constants/colors';

export function findPrimaryColorId(hexCode: string): PrimaryColorStateType | undefined {
  const primaryColors = getPrimaryColors();
  return find(primaryColors, { color: hexCode })?.id;
}

export async function switchPrimaryColorTo(color: PrimaryColorStateType, dispatch?: Dispatch) {
  if (window.Events) {
    await window.Events.setPrimaryColorSetting(color);
  }

  document.documentElement.style.setProperty(
    '--primary-color',
    COLORS.PRIMARY[`${color.toUpperCase() as keyof ColorsType['PRIMARY']}`]
  );
  dispatch?.(applyPrimaryColor(color));
}

import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

type Props = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  interactive?: boolean;
  tintColor?: string;
  clear?: boolean;
};

export default function NouraGlass({ style, children, interactive = false, tintColor, clear = false }: Props) {
  const available = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  if (!available) {
    return <View style={[{ backgroundColor: 'rgba(255,255,255,0.78)' }, style]}>{children}</View>;
  }
  return (
    <GlassView
      style={style}
      glassEffectStyle={clear ? 'clear' : 'regular'}
      isInteractive={interactive}
      tintColor={tintColor}
    >
      {children}
    </GlassView>
  );
}

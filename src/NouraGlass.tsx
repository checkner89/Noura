import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

type Props = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  interactive?: boolean;
  tintColor?: string;
  clear?: boolean;
  fallbackColor?: string;
};

export default function NouraGlass({ style, children, interactive = false, tintColor, clear = false, fallbackColor = 'rgba(255,255,255,0.78)' }: Props) {
  const available = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  if (!available) {
    return <View style={[{ backgroundColor: fallbackColor }, style]}>{children}</View>;
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

'use client';

import React from 'react';
import UseAnimations, { type Animation, type Interaction } from 'react-useanimations';

export interface AnimatedIconProps {
  animation: Animation;
  size?: number | string;
  strokeColor?: string;
  fillColor?: string;
  interaction?: Interaction;
  active?: boolean;
  speed?: number;
  loop?: boolean | number;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
}

export function AnimatedIcon({
  animation,
  size = 18,
  strokeColor = 'currentColor',
  interaction = 'hover-replay',
  speed = 1,
  className,
  style,
  ...props
}: AnimatedIconProps) {
  return (
    <UseAnimations
      animation={animation}
      size={size}
      strokeColor={strokeColor}
      interaction={interaction}
      speed={speed}
      className={className}
      style={style}
      {...props}
    />
  );
}

export default AnimatedIcon;

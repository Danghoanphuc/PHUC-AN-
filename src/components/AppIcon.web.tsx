import React from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import { webIcons } from '../assets/webIcons';

export default function AppIcon({
  name,
  size = 21,
  color,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  color?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: 'block', flexShrink: 0, color, fill: 'currentColor' }}
      dangerouslySetInnerHTML={{ __html: webIcons[name] ?? webIcons['help-circle-outline']! }}
    />
  );
}

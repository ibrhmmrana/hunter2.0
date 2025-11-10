"use client";

import { cn } from "@/lib/utils";

interface VisualTrustGaugeProps {
  value: number; // 0-100
  size?: number; // diameter in pixels
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean; // Whether to show the built-in label
}

export function VisualTrustGauge({ 
  value, 
  size = 120, 
  strokeWidth = 8,
  className,
  showLabel = true
}: VisualTrustGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const getLabel = (val: number): { text: string; color: string } => {
    if (val >= 90) return { text: 'Excellent', color: 'text-green-600' };
    if (val >= 75) return { text: 'Strong', color: 'text-blue-600' };
    if (val >= 60) return { text: 'Fair', color: 'text-yellow-600' };
    return { text: 'Risky', color: 'text-red-600' };
  };

  const getStrokeColor = (val: number): string => {
    // Use current success color at 80% opacity for softer appearance
    if (val >= 90) return 'rgba(22, 163, 74, 0.8)'; // green-600 at 80%
    if (val >= 75) return 'rgba(37, 99, 235, 0.8)'; // blue-600 at 80%
    if (val >= 60) return 'rgba(202, 138, 4, 0.8)'; // yellow-600 at 80%
    return 'rgba(220, 38, 38, 0.8)'; // red-600 at 80%
  };

  const label = getLabel(value);
  const strokeColor = getStrokeColor(value);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          role="img"
          aria-label={`Visual Trust: ${value}% (${label.text})`}
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-in-out"
            style={{
              filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.1))',
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-900">{value}</span>
          <span className="text-xs text-gray-500">%</span>
        </div>
      </div>
      {/* Label */}
      {showLabel && (
        <span className={cn("text-sm font-medium mt-2", label.color)}>
          {label.text}
        </span>
      )}
    </div>
  );
}


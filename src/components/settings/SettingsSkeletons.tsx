// src/components/settings/SettingsSkeletons.tsx

import React from 'react';

export const SkeletonLine: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-700 rounded ${className}`}></div>
);

export const SkeletonCircle: React.FC<{ size?: string }> = ({ size = 'w-16 h-16' }) => (
  <div className={`animate-pulse bg-gray-700 rounded-full ${size}`}></div>
);

export const ProfileSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <SkeletonCircle />
      <div className="flex-1 space-y-2">
        <SkeletonLine className="h-4 w-48" />
        <SkeletonLine className="h-3 w-32" />
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <SkeletonLine className="h-4 w-24 mb-2" />
        <SkeletonLine className="h-10 w-full" />
      </div>
      <div>
        <SkeletonLine className="h-4 w-24 mb-2" />
        <SkeletonLine className="h-10 w-full" />
      </div>
    </div>

    <div>
      <SkeletonLine className="h-4 w-32 mb-2" />
      <SkeletonLine className="h-24 w-full" />
    </div>
  </div>
);

export const AccountSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div>
      <SkeletonLine className="h-4 w-24 mb-2" />
      <SkeletonLine className="h-10 w-full" />
      <SkeletonLine className="h-3 w-48 mt-1" />
    </div>

    <div className="p-4 bg-gray-900 rounded-lg border border-gray-700/50 space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex justify-between">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-4 w-32" />
        </div>
      ))}
    </div>
  </div>
);

export const StorageSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div>
      <div className="flex justify-between mb-2">
        <SkeletonLine className="h-4 w-32" />
        <SkeletonLine className="h-4 w-24" />
      </div>
      <SkeletonLine className="h-2.5 w-full rounded-full" />
      <SkeletonLine className="h-3 w-20 mt-1" />
    </div>

    <div className="grid grid-cols-2 gap-4 pt-4">
      {[1, 2].map((i) => (
        <div key={i} className="p-4 bg-gray-900 rounded-lg border border-gray-700/50">
          <SkeletonLine className="h-3 w-24 mb-2" />
          <SkeletonLine className="h-8 w-16" />
        </div>
      ))}
    </div>

    <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/30">
      <SkeletonLine className="h-3 w-24 mb-2" />
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex justify-between">
            <SkeletonLine className="h-3 w-16" />
            <SkeletonLine className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const BillingSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="space-y-3">
      <SkeletonLine className="h-6 w-32" />
      <SkeletonLine className="h-4 w-full" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-5 bg-gray-900 border border-gray-700 rounded-xl">
          <SkeletonLine className="h-5 w-24 mb-2" />
          <SkeletonLine className="h-8 w-16 mb-4" />
          <div className="space-y-2">
            <SkeletonLine className="h-4 w-full" />
            <SkeletonLine className="h-4 w-full" />
            <SkeletonLine className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  </div>
);
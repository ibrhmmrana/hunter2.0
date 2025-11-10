export function ConfirmBusinessSkeleton() {
  return (
    <div className="rounded-2xl bg-white shadow-soft p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Media Column Skeleton */}
      <div className="lg:col-span-7 space-y-4">
        {/* Hero Image Skeleton */}
        <div className="relative w-full aspect-video rounded-2xl bg-gray-200 animate-pulse" />
        
        {/* Thumbnail Rail Skeleton */}
        <div className="flex gap-2 overflow-x-auto">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-20 h-20 rounded-xl bg-gray-200 animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* Details Column Skeleton */}
      <div className="lg:col-span-5 space-y-4">
        {/* Title Skeleton */}
        <div className="h-8 bg-gray-200 rounded-lg w-3/4 animate-pulse" />
        
        {/* Meta Chips Skeleton */}
        <div className="flex gap-2 flex-wrap">
          <div className="h-6 bg-gray-200 rounded-full w-32 animate-pulse" />
          <div className="h-6 bg-gray-200 rounded-full w-24 animate-pulse" />
        </div>

        {/* KPI Row Skeleton */}
        <div className="flex gap-4">
          <div className="h-5 bg-gray-200 rounded w-20 animate-pulse" />
          <div className="h-5 bg-gray-200 rounded w-24 animate-pulse" />
        </div>

        {/* Action Buttons Skeleton */}
        <div className="space-y-3 pt-4">
          <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-10 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
    </div>
  );
}


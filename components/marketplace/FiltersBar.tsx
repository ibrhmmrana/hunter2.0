"use client";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ServiceType,
  SERVICE_TYPE_LABELS,
  AVAILABLE_INTERESTS,
  FOLLOWER_RANGES,
  GENDER_OPTIONS,
  FollowerRange,
  GenderFilter,
} from "./types";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FiltersBarProps {
  selectedServiceTypes: ServiceType[];
  onServiceTypeToggle: (type: ServiceType | "all") => void;
  locationFilter: string;
  onLocationChange: (value: string) => void;
  selectedInterests: string[];
  onInterestToggle: (interest: string) => void;
  followerRange: FollowerRange;
  onFollowerRangeChange: (range: FollowerRange) => void;
  genderFilter: GenderFilter;
  onGenderChange: (gender: GenderFilter) => void;
  resultCount: number;
  totalCount: number;
}

export function FiltersBar({
  selectedServiceTypes,
  onServiceTypeToggle,
  locationFilter,
  onLocationChange,
  selectedInterests,
  onInterestToggle,
  followerRange,
  onFollowerRangeChange,
  genderFilter,
  onGenderChange,
  resultCount,
  totalCount,
}: FiltersBarProps) {
  const serviceTypeOptions: (ServiceType | "all")[] = [
    "all",
    "review_booster",
    "ugc_creator",
    "local_influencer",
    "social_boost",
  ];

  const isAllSelected = selectedServiceTypes.length === 0;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
      {/* Service Type Pills */}
      <div>
        <label className="text-xs font-medium text-slate-600 mb-2 block">
          Service type
        </label>
        <div className="flex flex-wrap gap-2">
          {serviceTypeOptions.map((type) => {
            const isSelected =
              type === "all" ? isAllSelected : selectedServiceTypes.includes(type);
            const label = type === "all" ? "All" : SERVICE_TYPE_LABELS[type];

            return (
              <button
                key={type}
                onClick={() => onServiceTypeToggle(type)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Other Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Location */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-2 block">
            Location (suburb / city)
          </label>
          <Input
            type="text"
            placeholder="e.g. Parkhurst, Johannesburg"
            value={locationFilter}
            onChange={(e) => onLocationChange(e.target.value)}
            className="bg-white"
          />
        </div>

        {/* Interests */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-2 block">
            Interests
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between bg-white"
              >
                <span className="truncate">
                  {selectedInterests.length === 0
                    ? "Select interests"
                    : `${selectedInterests.length} selected`}
                </span>
                <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-2xl" align="start">
              <DropdownMenuLabel>Select Interests</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {AVAILABLE_INTERESTS.map((interest) => (
                <DropdownMenuCheckboxItem
                  key={interest}
                  checked={selectedInterests.includes(interest)}
                  onCheckedChange={() => onInterestToggle(interest)}
                >
                  {interest}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {selectedInterests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedInterests.map((interest) => (
                <Badge
                  key={interest}
                  variant="secondary"
                  className="text-xs bg-slate-200 text-slate-700"
                >
                  {interest}
                  <button
                    onClick={() => onInterestToggle(interest)}
                    className="ml-1.5 hover:text-slate-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Followers */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-2 block">
            Followers
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between bg-white"
              >
                <span>
                  {FOLLOWER_RANGES.find((r) => r.value === followerRange)?.label}
                </span>
                <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 rounded-2xl" align="start">
              <DropdownMenuLabel>Follower Range</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={followerRange}
                onValueChange={(value) => onFollowerRangeChange(value as FollowerRange)}
              >
                {FOLLOWER_RANGES.map((range) => (
                  <DropdownMenuRadioItem key={range.value} value={range.value}>
                    {range.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Gender */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-2 block">
            Gender
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between bg-white"
              >
                <span>
                  {GENDER_OPTIONS.find((g) => g.value === genderFilter)?.label}
                </span>
                <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 rounded-2xl" align="start">
              <DropdownMenuLabel>Gender</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={genderFilter}
                onValueChange={(value) => onGenderChange(value as GenderFilter)}
              >
                {GENDER_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-end pt-2 border-t border-slate-200">
        <p className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{resultCount}</span> of{" "}
          <span className="font-semibold text-slate-900">{totalCount}</span> results
        </p>
      </div>
    </div>
  );
}


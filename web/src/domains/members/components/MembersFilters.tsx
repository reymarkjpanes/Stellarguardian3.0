"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function MembersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL State Updates
  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleFilterChange = (key: string, value: string) => {
    router.push(pathname + "?" + createQueryString(key, value), { scroll: false });
  };

  const currentRole = searchParams.get("role") || "";
  const currentAvailability = searchParams.get("availability") || "";

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-md bg-card">
      <div className="flex-1">
        <label className="text-sm font-medium mb-1 block">Role</label>
        <select 
          className="w-full p-2 border rounded"
          value={currentRole}
          onChange={(e) => handleFilterChange("role", e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
          <option value="design">Design</option>
        </select>
      </div>

      <div className="flex-1">
        <label className="text-sm font-medium mb-1 block">Availability</label>
        <select 
          className="w-full p-2 border rounded"
          value={currentAvailability}
          onChange={(e) => handleFilterChange("availability", e.target.value)}
        >
          <option value="">Any Status</option>
          <option value="available">Available for Team</option>
          <option value="in_team">In Team</option>
        </select>
      </div>
      
      {/* Additional filters: Skills, Timezone, Experience, Language can go here */}
    </div>
  );
}

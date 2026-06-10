"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function FeedTabs() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "for_you" ? "for_you" : "following";
  return (
    <Tabs value={tab} onValueChange={(v) => router.push(`/?tab=${v}`)}>
      <TabsList className="w-full">
        <TabsTrigger value="following" className="flex-1">
          Following
        </TabsTrigger>
        <TabsTrigger value="for_you" className="flex-1">
          For You
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

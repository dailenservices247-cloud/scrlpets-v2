"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostForm } from "./PostForm";
import { ListingForm } from "./ListingForm";

export function ComposerTabs({
  userId,
  creatures,
}: {
  userId: string;
  creatures: { id: string; name: string }[];
}) {
  const t = useTranslations("compose");
  const [tab, setTab] = useState("post");
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full">
        <TabsTrigger value="post" className="flex-1">
          {t("tabPost")}
        </TabsTrigger>
        <TabsTrigger value="listing" className="flex-1">
          {t("tabListing")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="post">
        <PostForm userId={userId} creatures={creatures} />
      </TabsContent>
      <TabsContent value="listing">
        <ListingForm userId={userId} creatures={creatures} />
      </TabsContent>
    </Tabs>
  );
}

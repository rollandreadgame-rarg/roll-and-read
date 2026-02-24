"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function useProfile(profileId?: string) {
  const { user } = useUser();

  const profile = useQuery(
    api.profiles.get,
    profileId ? { profileId: profileId as Id<"profiles"> } : "skip"
  );

  const updateProfile = useMutation(api.profiles.update);
  const awardCoins = useMutation(api.profiles.awardCoins);

  return {
    profile,
    updateProfile,
    awardCoins,
    isLoading: profile === undefined,
  };
}

export function useProfileSelector() {
  const { user } = useUser();

  const clerkUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  const profiles = useQuery(
    api.profiles.getByUser,
    clerkUser?._id ? { userId: clerkUser._id } : "skip"
  );

  const createProfile = useMutation(api.profiles.create);

  return {
    profiles: profiles ?? [],
    clerkUser,
    createProfile,
    isLoading: clerkUser === undefined || profiles === undefined,
  };
}

/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function useProfile(profileId?: string) {
  const { user } = useCurrentUser();

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
  const { user } = useCurrentUser();

  const clerkUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  const ensureUser = useMutation(api.users.createUser);

  // Auto-create the Convex user record on first sign-in if the webhook hasn't run
  useEffect(() => {
    if (user?.id && clerkUser === null) {
      ensureUser({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? "",
      });
    }
  }, [user?.id, clerkUser]);

  const profiles = useQuery(
    api.profiles.getByUser,
    clerkUser?._id ? { userId: clerkUser._id } : "skip"
  );

  const createProfile = useMutation(api.profiles.create);

  return {
    profiles: profiles ?? [],
    clerkUser,
    createProfile,
    // Only loading while queries are pending — null means resolved (not found)
    isLoading: clerkUser === undefined || (clerkUser !== null && profiles === undefined),
  };
}

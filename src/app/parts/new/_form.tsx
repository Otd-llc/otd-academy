"use client";

// Client form for /parts/new. Shares PartFields with the modal in
// CreatePartDialog so behavior + validation stay consistent across both
// entry points. On success we redirect to /parts (Phase 5a doesn't have
// a parts list page yet; the redirect goes to the same /parts path the
// action's revalidatePath targets, and the route will land in M9+).
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createPartFormAction,
  type PartFormState,
} from "@/lib/actions/parts";
import { PartFields } from "@/components/CreatePartDialog";

const initialState: PartFormState = {};

export function NewPartForm() {
  const [state, action] = useActionState(createPartFormAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.created) {
      // /parts list page lands in M9+ per design §9 — for now bounce back
      // home so the user has a known destination.
      router.push("/");
    }
  }, [state.created, router]);

  return <PartFields state={state} action={action} />;
}

import { apiFetch } from "./client";

export interface ProfileUpdate {
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
}

export async function updateMyProfile(data: ProfileUpdate): Promise<void> {
  await apiFetch("/responders/me", {
    method: "PUT",
    body: data,
  });
}

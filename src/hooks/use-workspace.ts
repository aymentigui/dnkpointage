import { create } from "zustand";

type State = {
  workspaceId: string;
};

type Actions = {
  setWorkspaceId: (workspaceId: string) => void;
};

export const useWorkspace = create<State & Actions>()((set) => ({
  workspaceId: "",
  setWorkspaceId: (workspaceId: string) => set({ workspaceId }),
}));

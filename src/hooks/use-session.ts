import { create } from "zustand";

type State = {
    session : any
};

type Actions = {
    setSession : (session: any) => void;
};

export const useSession = create<State & Actions>()((set) => ({
    session : {},
    setSession: (session: boolean) => set({ session }),
}))
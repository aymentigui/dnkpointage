import { create } from "zustand";

type State = {
    hasPermissionUpdateRoles: boolean;
    hasPermissionUpdateUsers: boolean;
    hasPermissionDeleteUsers: boolean;
    hasPermissionDeleteRoles: boolean;
    hasPermissionCreateUsers: boolean;
    hasPermissionCreateRoles: boolean;
};

type Actions = {
    setHasPermissionCreateRoles: (hasPermissionCreateRoles: boolean) => void;
    setHasPermissionUpdateRoles: (hasPermissionUpdateRoles: boolean) => void;
    setHasPermissionDeleteRoles: (hasPermissionDeleteRoles: boolean) => void;
    setHasPermissionCreateUsers: (hasPermissionCreateUsers: boolean) => void;
    setHasPermissionUpdateUsers: (hasPermissionUpdateUsers: boolean) => void;
    setHasPermissionDeleteUsers: (hasPermissionDeleteUsers: boolean) => void;
};

export const usePermissions = create<State & Actions>()((set) => ({
    hasPermissionUpdateRoles: false,
    hasPermissionUpdateUsers: false,
    hasPermissionDeleteUsers: false,
    hasPermissionDeleteRoles: false,
    hasPermissionCreateUsers: false,
    hasPermissionCreateRoles: false,
    setHasPermissionCreateRoles: (hasPermissionCreateRoles: boolean) => set({ hasPermissionCreateRoles }),
    setHasPermissionUpdateRoles: (hasPermissionUpdateRoles: boolean) => set({ hasPermissionUpdateRoles }),
    setHasPermissionDeleteRoles: (hasPermissionDeleteRoles: boolean) => set({ hasPermissionDeleteRoles }),
    setHasPermissionCreateUsers: (hasPermissionCreateUsers: boolean) => set({ hasPermissionCreateUsers }),  
    setHasPermissionUpdateUsers: (hasPermissionUpdateUsers: boolean) => set({ hasPermissionUpdateUsers }),
    setHasPermissionDeleteUsers: (hasPermissionDeleteUsers: boolean) => set({ hasPermissionDeleteUsers }),
}))
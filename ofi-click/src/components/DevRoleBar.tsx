import React, { useState } from 'react';
import { ChevronUp, FlaskConical, LogOut, RotateCcw } from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import type { UserRoleType } from '../types/oficlick';

const DEV_ROLES: { role: UserRoleType; label: string }[] = [
  { role: 'client', label: 'Cliente' },
  { role: 'independent_pro', label: 'Freelancer' },
  { role: 'central_admin', label: 'Administrador central' },
];

const ROLE_LABELS: Record<UserRoleType, string> = {
  client: 'Cliente',
  independent_pro: 'Freelancer',
  central_admin: 'Admin central',
};

export const DevRoleBar: React.FC = () => {
  const { currentUser, switchWorkspaceRole, signOut, resetLocalWorkspace } = useOfiClick();
  const [open, setOpen] = useState(false);

  // Strictly visible only in development environment
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-40">
      {open ? (
        <div className="w-64 rounded-xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/15 shadow-2xl p-3.5 text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#DBD4C6] dark:border-white/10">
            <span className="font-display font-semibold flex items-center gap-1.5 text-[#1D252C] dark:text-[#F7F3EA]">
              <FlaskConical className="w-3.5 h-3.5 text-[#C7582B]" />
              Espacios locales (DEV)
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[#73766F] hover:text-[#1D252C] dark:hover:text-white px-1.5 py-0.5"
            >
              Cerrar
            </button>
          </div>
          <div className="space-y-1">
            {DEV_ROLES.map((item) => {
              const active = currentUser?.primaryRole === item.role;
              return (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => {
                    switchWorkspaceRole(item.role);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors ${
                    active
                      ? 'bg-[#214438] text-white font-semibold'
                      : 'hover:bg-[#ECE7DC] dark:hover:bg-white/10 text-[#1D252C] dark:text-[#F7F3EA]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 pt-2 border-t border-[#DBD4C6] dark:border-white/10 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={resetLocalWorkspace}
              className="inline-flex items-center gap-1 text-[11px] text-[#73766F] hover:text-[#1D252C] dark:hover:text-white"
            >
              <RotateCcw className="w-3 h-3" />
              Restablecer datos
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 hover:underline"
              >
                <LogOut className="w-3 h-3" />
                Salir
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1D252C] dark:bg-[#C7582B] text-[#F7F3EA] dark:text-white text-xs font-semibold shadow-lg border border-white/10 hover:opacity-95 transition-opacity"
        >
          <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {currentUser ? `Rol: ${ROLE_LABELS[currentUser.primaryRole]}` : 'Cambiar rol'}
          </span>
          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

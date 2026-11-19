import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'operator' | 'supervisor' | 'quality';

interface RoleContextType {
  role: UserRole;
  userName: string;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>('operator');

  const getUserName = (r: UserRole): string => {
    switch (r) {
      case 'operator': return 'Operator Jane Doe (Shift A)';
      case 'supervisor': return 'Supervisor Dave Miller (Plant Floor)';
      case 'quality': return 'Quality Auditor Sarah Chen (QA)';
    }
  };

  const [userName, setUserName] = useState<string>(getUserName('operator'));

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    setUserName(getUserName(newRole));
  };

  return (
    <RoleContext.Provider value={{ role, userName, setRole }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = (): RoleContextType => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

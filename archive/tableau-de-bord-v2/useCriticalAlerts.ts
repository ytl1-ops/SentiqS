import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

export default function PageTransition({ children }: Props) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="dashboard-page-transition page-enter">
      {children}
    </div>
  );
}
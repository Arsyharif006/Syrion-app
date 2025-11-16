import React from 'react';
import { LandingPage } from './LandingPage';

interface AuthProps {
  onAuthSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  return <LandingPage onAuthSuccess={onAuthSuccess} />;
};
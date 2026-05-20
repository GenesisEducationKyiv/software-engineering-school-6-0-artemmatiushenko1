import React from 'react';
import { Github } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#f6f8fa] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-[600px] mx-auto">
        <div className="flex justify-center mb-8">
          <Github className="w-12 h-12 text-[#24292e]" />
        </div>
        <main>{children}</main>
        <footer className="mt-8 pt-6 border-t border-[#e1e4e8] text-center text-[13px] text-[#6a737d]">
          <p>
            You're receiving this because you're interested in GitHub release
            notifications.
          </p>
        </footer>
      </div>
    </div>
  );
}
